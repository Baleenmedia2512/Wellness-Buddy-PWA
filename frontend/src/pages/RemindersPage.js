import React, { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  Bell, BellOff, ArrowLeft, Save, Clock,
  Scale, BookOpen, Coffee, UtensilsCrossed, Soup, CheckCircle, AlertCircle, RefreshCw
} from 'lucide-react';
import {
  fetchReminders,
  saveReminders,
  DEFAULT_REMINDERS,
  ACTIVITY_META,
} from '../services/reminderService';
import { ReminderPlugin } from '../plugins/reminderPlugin';
import LoadingSpinner from '../components/LoadingSpinner';

// ─── Activity icon map ───────────────────────────────────────────────────────
const ACTIVITY_ICONS = {
  weight:    <Scale className="w-5 h-5" />,
  education: <BookOpen className="w-5 h-5" />,
  breakfast: <Coffee className="w-5 h-5" />,
  lunch:     <Soup className="w-5 h-5" />,
  dinner:    <UtensilsCrossed className="w-5 h-5" />,
};

const ACTIVITY_COLORS = {
  weight:    'from-blue-500 to-blue-600',
  education: 'from-purple-500 to-purple-600',
  breakfast: 'from-orange-400 to-orange-500',
  lunch:     'from-green-500 to-green-600',
  dinner:    'from-red-400 to-red-500',
};

const ACTIVITY_BG = {
  weight:    'bg-blue-50 border-blue-100',
  education: 'bg-purple-50 border-purple-100',
  breakfast: 'bg-orange-50 border-orange-100',
  lunch:     'bg-green-50 border-green-100',
  dinner:    'bg-red-50 border-red-100',
};

// ─── Format helpers ──────────────────────────────────────────────────────────

/** Format stored hour/minute (notify time) → display "actual activity time" (+15 min) */
function displayTime(hour, minute) {
  // The stored time is already the "notify at" time.
  // Display it directly — 07:45 means "you'll be notified at 07:45 for 08:00 activity"
  const h = String(hour).padStart(2, '0');
  const m = String(minute).padStart(2, '0');
  const suffix = hour < 12 ? 'AM' : 'PM';
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${String(h12).padStart(2, '0')}:${m} ${suffix}`;
}

/** Convert hour/minute to <input type="time"> value */
function toTimeValue(hour, minute) {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** Parse <input type="time"> value back to { hour, minute } */
function parseTimeValue(value) {
  const [h, m] = value.split(':').map(Number);
  return { hour: h, minute: m };
}

// ─── Component ───────────────────────────────────────────────────────────────

const RemindersPage = ({ onBack, userId }) => {
  const [reminders, setReminders]           = useState([]);
  const [loading, setLoading]               = useState(true);
  const [saving, setSaving]                 = useState(false);
  const [toast, setToast]                   = useState(null); // { type: 'success'|'error', msg }
  const [exactAlarmGranted, setExactAlarmGranted] = useState(true);

  // ── Load reminders on mount ──────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const data = await fetchReminders(userId);
        if (!cancelled) setReminders(data);
      } catch {
        if (!cancelled) setReminders([...DEFAULT_REMINDERS]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [userId]);

  // ── Check exact alarm permission (Android 12+) ───────────────────────────
  useEffect(() => {
    async function checkPerm() {
      if (!Capacitor.isNativePlatform()) return;
      const { granted } = await ReminderPlugin.checkPermission();
      setExactAlarmGranted(granted);
    }
    checkPerm();
  }, []);

  // ── Auto-dismiss toast ───────────────────────────────────────────────────
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Toggle enabled/disabled ──────────────────────────────────────────────
  const handleToggle = useCallback((activityType) => {
    setReminders(prev =>
      prev.map(r =>
        r.activity_type === activityType ? { ...r, is_enabled: !r.is_enabled } : r
      )
    );
  }, []);

  // ── Change time ──────────────────────────────────────────────────────────
  const handleTimeChange = useCallback((activityType, value) => {
    const { hour, minute } = parseTimeValue(value);
    setReminders(prev =>
      prev.map(r =>
        r.activity_type === activityType
          ? { ...r, reminder_hour: hour, reminder_minute: minute }
          : r
      )
    );
  }, []);

  // ── Save ─────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!userId) {
      setToast({ type: 'error', msg: 'Please log in to save reminders.' });
      return;
    }
    setSaving(true);
    try {
      await saveReminders(userId, reminders);
      setToast({ type: 'success', msg: '✅ Reminders saved & alarms updated!' });
    } catch (err) {
      console.error('[RemindersPage] Save failed:', err);
      setToast({ type: 'error', msg: '❌ Failed to save. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  // ── Request exact alarm permission ────────────────────────────────────────
  const handleRequestPermission = async () => {
    await ReminderPlugin.requestExactAlarmPermission();
    const { granted } = await ReminderPlugin.checkPermission();
    setExactAlarmGranted(granted);
  };

  // ─────────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  const enabledCount = reminders.filter(r => r.is_enabled).length;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">

      {/* ── Header ── */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-3 px-4 py-4">
          <button
            onClick={onBack}
            className="p-2 rounded-xl hover:bg-gray-100 active:bg-gray-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-gray-900">Reminders</h1>
            <p className="text-xs text-gray-500">
              {enabledCount} of {reminders.length} active • Notified 15 min early
            </p>
          </div>
          <Bell className="w-5 h-5 text-indigo-500" />
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-5 space-y-4">

        {/* ── Exact alarm permission banner (Android 12+) ── */}
        {!exactAlarmGranted && Capacitor.isNativePlatform() && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3 items-start">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-900 mb-1">Permission Required</p>
              <p className="text-xs text-amber-700 mb-3">
                Allow "Alarms & Reminders" permission so notifications fire at the exact time.
              </p>
              <button
                onClick={handleRequestPermission}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                Grant Permission
              </button>
            </div>
          </div>
        )}

        {/* ── Info card ── */}
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex gap-3 items-start">
          <Clock className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-indigo-700 leading-relaxed">
            Set the time at which you want to be reminded. The notification will arrive
            <span className="font-semibold"> 15 minutes before</span> your selected activity time.
          </p>
        </div>

        {/* ── Reminder cards ── */}
        {reminders.map((reminder) => {
          const meta    = ACTIVITY_META[reminder.activity_type];
          const icon    = ACTIVITY_ICONS[reminder.activity_type];
          const color   = ACTIVITY_COLORS[reminder.activity_type];
          const bgClass = ACTIVITY_BG[reminder.activity_type];

          if (!meta) return null;

          return (
            <div
              key={reminder.activity_type}
              className={`rounded-2xl border p-4 transition-all ${
                reminder.is_enabled ? bgClass : 'bg-gray-100 border-gray-200 opacity-70'
              }`}
            >
              {/* Card header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`bg-gradient-to-br ${color} p-2 rounded-xl text-white shadow-sm`}>
                    {icon}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">{meta.label}</p>
                    {reminder.is_enabled ? (
                      <p className="text-xs text-gray-500">
                        Notify at {displayTime(reminder.reminder_hour, reminder.reminder_minute)}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-400">Disabled</p>
                    )}
                  </div>
                </div>

                {/* Toggle switch */}
                <button
                  onClick={() => handleToggle(reminder.activity_type)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                    reminder.is_enabled ? 'bg-indigo-500' : 'bg-gray-300'
                  }`}
                  aria-label={`Toggle ${meta.label} reminder`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      reminder.is_enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Time picker — only visible when enabled */}
              {reminder.is_enabled && (
                <div className="mt-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Activity time (notification 15 min before)
                  </label>
                  <input
                    type="time"
                    value={toTimeValue(reminder.reminder_hour, reminder.reminder_minute)}
                    onChange={(e) => handleTimeChange(reminder.activity_type, e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-800 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition"
                  />
                </div>
              )}
            </div>
          );
        })}

        {/* ── Save button ── */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-60 text-white font-semibold py-4 rounded-2xl shadow-md transition-colors mt-2"
        >
          {saving ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save Reminders
            </>
          )}
        </button>

      </div>

      {/* ── Toast notification ── */}
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-5 py-3 rounded-2xl shadow-xl text-sm font-semibold transition-all ${
            toast.type === 'success'
              ? 'bg-green-600 text-white'
              : 'bg-red-600 text-white'
          }`}
        >
          {toast.type === 'success'
            ? <CheckCircle className="w-4 h-4" />
            : <AlertCircle className="w-4 h-4" />
          }
          {toast.msg}
        </div>
      )}
    </div>
  );
};

export default RemindersPage;
