/**
 * reminderService.js
 *
 * Handles all reminder logic:
 *   1. Fetch reminders from Supabase (via Next.js API)
 *   2. Cache in localStorage for offline use
 *   3. Apply to Android AlarmManager via ReminderPlugin (Capacitor)
 *
 * Each reminder fires 15 minutes BEFORE the user-set time.
 * The stored hour/minute IS already the "notify at" time (pre-shifted).
 * e.g. User sets Breakfast at 08:00 → store 07:45 → alarm fires at 07:45.
 */

import { apiClient } from './apiClient';
import { ReminderPlugin } from '../plugins/reminderPlugin';

const CACHE_KEY = 'wellness_reminders_cache';

// ─── Default reminder times ────────────────────────────────────────────────
export const DEFAULT_REMINDERS = [
  { activity_type: 'weight',    reminder_hour: 6,  reminder_minute: 45, is_enabled: true },
  { activity_type: 'education', reminder_hour: 8,  reminder_minute: 45, is_enabled: true },
  { activity_type: 'breakfast', reminder_hour: 7,  reminder_minute: 45, is_enabled: true },
  { activity_type: 'lunch',     reminder_hour: 11, reminder_minute: 45, is_enabled: true },
  { activity_type: 'dinner',    reminder_hour: 18, reminder_minute: 45, is_enabled: true },
];

// ─── Emoji / display labels ────────────────────────────────────────────────
export const ACTIVITY_META = {
  weight:    { label: 'Weight Tracking', emoji: '⚖️',  notifyTitle: '⚖️ Weight Tracking Reminder',   notifyBody: 'Time to record your weight in 15 minutes!' },
  education: { label: 'Education',       emoji: '📚',  notifyTitle: '📚 Education Reminder',          notifyBody: 'Your education session starts in 15 minutes!' },
  breakfast: { label: 'Breakfast',       emoji: '🍳',  notifyTitle: '🍳 Breakfast Reminder',          notifyBody: 'Breakfast time in 15 minutes — eat healthy!' },
  lunch:     { label: 'Lunch',           emoji: '🍱',  notifyTitle: '🍱 Lunch Reminder',              notifyBody: 'Lunch is in 15 minutes — don\'t skip it!' },
  dinner:    { label: 'Dinner',          emoji: '🍽️', notifyTitle: '🍽️ Dinner Reminder',            notifyBody: 'Dinner time in 15 minutes — enjoy your meal!' },
};

// ─── Unique Android request codes per activity ─────────────────────────────
export const ALARM_IDS = {
  weight:    1001,
  education: 1002,
  breakfast: 1003,
  lunch:     1004,
  dinner:    1005,
};

// ──────────────────────────────────────────────────────────────────────────
// localStorage cache helpers
// ──────────────────────────────────────────────────────────────────────────

function saveToCache(reminders) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ reminders, cachedAt: Date.now() }));
  } catch (e) {
    console.warn('[ReminderService] Cache write failed:', e);
  }
}

function loadFromCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed.reminders || null;
  } catch (e) {
    return null;
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Fetch from backend (Supabase via Next.js API)
// ──────────────────────────────────────────────────────────────────────────

/**
 * Load reminders for a user.
 * Falls back to localStorage cache → then defaults if API fails.
 */
export async function fetchReminders(userId) {
  if (!userId) return DEFAULT_REMINDERS;

  try {
    const data = await apiClient.get(
      `/api/get-reminder-settings?userId=${encodeURIComponent(userId)}`,
      { cache: false }
    );
    if (data?.success && Array.isArray(data.reminders)) {
      saveToCache(data.reminders);
      return data.reminders;
    }
  } catch (err) {
    console.warn('[ReminderService] API fetch failed, using cache:', err);
  }

  // Offline fallback
  const cached = loadFromCache();
  if (cached) return cached;

  return DEFAULT_REMINDERS;
}

// ──────────────────────────────────────────────────────────────────────────
// Save to backend + reschedule alarms
// ──────────────────────────────────────────────────────────────────────────

/**
 * Save reminder settings and reschedule all alarms.
 * @param {string} userId
 * @param {Array}  reminders  - array of 5 reminder objects
 */
export async function saveReminders(userId, reminders) {
  if (!userId) throw new Error('userId is required');

  // 1. Save to Supabase via backend API
  const data = await apiClient.post('/api/save-reminder-settings', { userId, reminders });

  if (!data?.success) {
    throw new Error(data?.message || 'Failed to save reminders');
  }

  // 2. Update localStorage cache
  saveToCache(reminders);

  // 3. Reschedule alarms on device
  await applyRemindersToAlarmManager(reminders);

  return data;
}

// ──────────────────────────────────────────────────────────────────────────
// AlarmManager scheduling
// ──────────────────────────────────────────────────────────────────────────

/**
 * Apply all reminders to Android AlarmManager via ReminderPlugin.
 * Cancels disabled reminders, schedules enabled ones.
 */
export async function applyRemindersToAlarmManager(reminders) {
  for (const reminder of reminders) {
    const alarmId = ALARM_IDS[reminder.activity_type];
    const meta    = ACTIVITY_META[reminder.activity_type];

    if (!alarmId || !meta) continue;

    try {
      if (reminder.is_enabled) {
        await ReminderPlugin.scheduleReminder({
          id:     alarmId,
          hour:   reminder.reminder_hour,
          minute: reminder.reminder_minute,
          title:  meta.notifyTitle,
          body:   meta.notifyBody,
        });
        console.log(`[ReminderService] ✅ Scheduled ${reminder.activity_type} at ${reminder.reminder_hour}:${String(reminder.reminder_minute).padStart(2,'0')}`);
      } else {
        await ReminderPlugin.cancelReminder({ id: alarmId });
        console.log(`[ReminderService] ❌ Cancelled ${reminder.activity_type}`);
      }
    } catch (err) {
      console.warn(`[ReminderService] Failed for ${reminder.activity_type}:`, err);
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────
// On-login sync: fetch from DB and re-apply alarms
// ──────────────────────────────────────────────────────────────────────────

/**
 * Call this after user login to restore reminders from DB and set alarms.
 */
export async function syncRemindersOnLogin(userId) {
  try {
    const reminders = await fetchReminders(userId);
    await applyRemindersToAlarmManager(reminders);
    console.log('[ReminderService] ✅ Reminders synced after login');
  } catch (err) {
    console.warn('[ReminderService] Sync on login failed:', err);
  }
}
