/**
 * ReminderSettingsPage.js
 *
 * Wellness Valley — Daily Activity Reminder Settings
 *
 * Features:
 *  • Fetches activity time windows from the backend
 *  • Auto-computes default reminder = WindowStartTime − 15 min
 *  • Per-activity toggle + editable time (hour/minute scroll picker)
 *  • Master on/off toggle
 *  • Exact-alarm permission banner for Android 12+
 *  • Reset to defaults button
 *  • All changes saved to localStorage + scheduled via AlarmManager
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft,
  Bell,
  BellOff,
  RefreshCw,
  Scale,
  BookOpen,
  Coffee,
  Utensils,
  Moon,
  Clock,
  ChevronDown,
  AlertTriangle,
  Check,
  Info,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Capacitor } from '@capacitor/core';
import TouchFeedbackButton from '../components/TouchFeedbackButton';
import {
  ACTIVITY_TYPES,
  ACTIVITY_LABELS,
  REMINDER_OFFSET,
  fetchTimeWindows,
  loadReminderPreferences,
  buildDefaultPreferences,
  mergePreferencesWithWindows,
  updateReminders,
  resetRemindersToDefaults,
  checkExactAlarmPermission,
  openExactAlarmSettings,
  formatReminderTime,
  subtractMinutes,
  parseTimeString,
} from '../services/reminderService';

// ── Activity icon/colour config ───────────────────────────────────────────────

const ACTIVITY_CONFIG = {
  weight: {
    label:    'Weight',
    icon:     Scale,
    color:    'text-purple-600',
    bg:       'bg-purple-50',
    ring:     'ring-purple-200',
    dot:      'bg-purple-500',
    light:    'bg-purple-100',
  },
  education: {
    label:    'Education',
    icon:     BookOpen,
    color:    'text-blue-600',
    bg:       'bg-blue-50',
    ring:     'ring-blue-200',
    dot:      'bg-blue-500',
    light:    'bg-blue-100',
  },
  breakfast: {
    label:    'Breakfast',
    icon:     Coffee,
    color:    'text-amber-600',
    bg:       'bg-amber-50',
    ring:     'ring-amber-200',
    dot:      'bg-amber-500',
    light:    'bg-amber-100',
  },
  lunch: {
    label:    'Lunch',
    icon:     Utensils,
    color:    'text-orange-600',
    bg:       'bg-orange-50',
    ring:     'ring-orange-200',
    dot:      'bg-orange-500',
    light:    'bg-orange-100',
  },
  dinner: {
    label:    'Dinner',
    icon:     Moon,
    color:    'text-indigo-600',
    bg:       'bg-indigo-50',
    ring:     'ring-indigo-200',
    dot:      'bg-indigo-500',
    light:    'bg-indigo-100',
  },
};

// ── Tiny Toggle component ─────────────────────────────────────────────────────

const Toggle = ({ enabled, onChange, disabled = false }) => (
  <button
    onClick={() => !disabled && onChange(!enabled)}
    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none
      ${enabled ? 'bg-green-500' : 'bg-gray-300'}
      ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
    aria-checked={enabled}
    role="switch"
  >
    <span
      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200
        ${enabled ? 'translate-x-6' : 'translate-x-1'}`}
    />
  </button>
);

// ── Scroll-wheel Time Picker ──────────────────────────────────────────────────

const TimeScrollPicker = ({ hour, minute, onChange, onClose }) => {
  const hours   = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: 60 }, (_, i) => i);

  const hoursRef   = useRef(null);
  const minutesRef = useRef(null);

  // Scroll to selected values on mount
  useEffect(() => {
    scrollToSelected(hoursRef,   hour,   44);
    scrollToSelected(minutesRef, minute, 44);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function scrollToSelected(ref, value, itemHeight) {
    if (ref.current) {
      // +32 to skip the "HOUR"/"MIN" header row
      ref.current.scrollTop = value * itemHeight;
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      onClick={(e) => e.stopPropagation()}
      className="absolute top-full left-0 right-0 z-50 mt-2 bg-white border border-gray-100 rounded-2xl shadow-2xl overflow-hidden"
    >
      <div className="px-3 pt-3 pb-1 border-b border-gray-50 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500">Set Reminder Time</span>
        <button
          onClick={onClose}
          className="text-xs font-semibold text-green-600 px-2 py-0.5 rounded-lg hover:bg-green-50"
        >
          Done
        </button>
      </div>

      <div className="flex gap-1 h-40 p-3">
        {/* Hours */}
        <div
          ref={hoursRef}
          className="flex-1 flex flex-col gap-0.5 overflow-y-auto no-scrollbar"
          style={{ scrollSnapType: 'y mandatory' }}
        >
          <div className="text-[10px] font-bold text-gray-400 text-center sticky top-0 bg-white py-1 z-10">
            HOUR
          </div>
          {hours.map((h) => (
            <button
              key={h}
              onClick={() => onChange(h, minute)}
              className={`py-2 rounded-lg text-sm font-medium transition-all shrink-0 scroll-snap-align-center
                ${h === hour
                  ? 'bg-green-600 text-white shadow-sm'
                  : 'text-gray-700 hover:bg-gray-50'}`}
            >
              {String(h).padStart(2, '0')}
            </button>
          ))}
        </div>

        <div className="w-px bg-gray-100 my-2" />

        {/* Minutes */}
        <div
          ref={minutesRef}
          className="flex-1 flex flex-col gap-0.5 overflow-y-auto no-scrollbar"
          style={{ scrollSnapType: 'y mandatory' }}
        >
          <div className="text-[10px] font-bold text-gray-400 text-center sticky top-0 bg-white py-1 z-10">
            MIN
          </div>
          {minutes.map((m) => (
            <button
              key={m}
              onClick={() => onChange(hour, m)}
              className={`py-2 rounded-lg text-sm font-medium transition-all shrink-0 scroll-snap-align-center
                ${m === minute
                  ? 'bg-green-600 text-white shadow-sm'
                  : 'text-gray-700 hover:bg-gray-50'}`}
            >
              {String(m).padStart(2, '0')}
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────

const ReminderSettingsPage = ({ onBack }) => {
  const [loading,       setLoading]       = useState(true);
  const [saving,        setSaving]        = useState(false);
  const [prefs,         setPrefs]         = useState(null);
  const [activePicker,  setActivePicker]  = useState(null); // activityType or null
  const [toast,         setToast]         = useState(null); // { type: 'success'|'error', msg }
  const [needsExactPerm, setNeedsExactPerm] = useState(false);
  const [resetting,     setResetting]     = useState(false);

  const isNative = Capacitor.isNativePlatform();

  // ── Load on mount ─────────────────────────────────────────────────────

  const loadPreferences = useCallback(async () => {
    setLoading(true);
    try {
      const windowMap  = await fetchTimeWindows();
      const savedPrefs = loadReminderPreferences();

      let currentPrefs;
      if (!savedPrefs) {
        currentPrefs = buildDefaultPreferences(windowMap);
      } else {
        currentPrefs = mergePreferencesWithWindows(savedPrefs, windowMap);
      }

      setPrefs(currentPrefs);

      // Check exact-alarm permission on Android 12+
      if (isNative) {
        const { canScheduleExact } = await checkExactAlarmPermission();
        setNeedsExactPerm(!canScheduleExact);
      }
    } catch (err) {
      console.error('[ReminderSettingsPage] Load error:', err);
      showToast('error', 'Failed to load reminder settings. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [isNative]);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  // Close picker on outside tap
  useEffect(() => {
    const handleOutside = () => setActivePicker(null);
    if (activePicker) {
      document.addEventListener('click', handleOutside);
      return () => document.removeEventListener('click', handleOutside);
    }
  }, [activePicker]);

  // ── Toast helper ─────────────────────────────────────────────────────

  function showToast(type, msg) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  }

  // ── Preference mutations ─────────────────────────────────────────────

  function setMaster(enabled) {
    setPrefs((prev) => ({ ...prev, masterEnabled: enabled }));
  }

  function setActivityEnabled(type, enabled) {
    setPrefs((prev) => ({
      ...prev,
      activities: {
        ...prev.activities,
        [type]: { ...prev.activities[type], enabled },
      },
    }));
  }

  function setActivityTime(type, hour, minute) {
    setPrefs((prev) => ({
      ...prev,
      activities: {
        ...prev.activities,
        [type]: { ...prev.activities[type], hour, minute },
      },
    }));
  }

  // ── Save ──────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!prefs) return;
    setSaving(true);
    try {
      await updateReminders(prefs);
      showToast('success', isNative
        ? 'Reminders saved and scheduled!'
        : 'Reminder preferences saved!');
    } catch (err) {
      console.error('[ReminderSettingsPage] Save error:', err);
      showToast('error', 'Failed to save reminders. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  // ── Reset to defaults ────────────────────────────────────────────────

  async function handleReset() {
    setResetting(true);
    try {
      const defaultPrefs = await resetRemindersToDefaults();
      setPrefs(defaultPrefs);
      showToast('success', 'Reset to defaults from Discipline Report timings!');
    } catch (err) {
      console.error('[ReminderSettingsPage] Reset error:', err);
      showToast('error', 'Failed to reset reminders.');
    } finally {
      setResetting(false);
    }
  }

  // ── Exact-alarm permission ───────────────────────────────────────────

  async function handleGrantExactAlarm() {
    await openExactAlarmSettings();
    // Re-check after a short delay (user may have come back from settings)
    setTimeout(async () => {
      const { canScheduleExact } = await checkExactAlarmPermission();
      setNeedsExactPerm(!canScheduleExact);
    }, 1500);
  }

  // ── Compute "default reminder time" label ────────────────────────────

  function getDefaultLabel(activity) {
    if (!activity?.windowStart) return null;
    const parsed = parseTimeString(activity.windowStart);
    if (!parsed) return null;
    const def = subtractMinutes(parsed.hour, parsed.minute, REMINDER_OFFSET);
    return formatReminderTime(def.hour, def.minute);
  }

  // ── Loading state ─────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex flex-col">
        {/* Header skeleton */}
        <div className="bg-white/90 backdrop-blur-lg border-b border-green-100 px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 bg-gray-100 rounded-full animate-pulse" />
          <div className="flex-1">
            <div className="h-4 w-32 bg-gray-100 rounded animate-pulse mb-1" />
            <div className="h-3 w-24 bg-gray-100 rounded animate-pulse" />
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-500">Loading reminder settings…</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────

  return (
    <div
      className="min-h-screen flex flex-col pb-24"
      style={{ backgroundColor: '#e8f5e9' }}
      onClick={() => setActivePicker(null)}
    >

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div
        className="sticky top-0 z-40 backdrop-blur-sm shadow-md"
        style={{ backgroundColor: '#a8dbb5', borderBottom: '1px solid #93c9a1' }}
      >
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TouchFeedbackButton
              onClick={onBack}
              className="p-2 -ml-1 rounded-full"
              ariaLabel="Go back"
            >
              <ArrowLeft className="h-5 w-5 text-gray-800" />
            </TouchFeedbackButton>
            <div>
              <h1 className="text-base font-bold text-gray-900 leading-tight">
                Reminders
              </h1>
              <p className="text-[11px] text-gray-600">
                Daily activity notifications
              </p>
            </div>
          </div>

          {/* Reset button */}
          <TouchFeedbackButton
            onClick={handleReset}
            disabled={resetting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/70 text-gray-700 text-xs font-medium"
            ariaLabel="Reset to defaults"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${resetting ? 'animate-spin text-green-600' : ''}`} />
            {resetting ? 'Resetting…' : 'Reset'}
          </TouchFeedbackButton>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────── */}
      <div className="max-w-lg mx-auto w-full px-4 pt-4 space-y-4">

        {/* ── Exact-alarm permission banner (Android 12+) ───────────── */}
        <AnimatePresence>
          {isNative && needsExactPerm && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3"
            >
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-800 mb-1">
                  Exact Alarm Permission Required
                </p>
                <p className="text-xs text-amber-700 mb-3 leading-relaxed">
                  Android 12+ requires explicit permission to schedule exact
                  reminders. Without it, alarms may be delayed by the OS.
                </p>
                <TouchFeedbackButton
                  onClick={handleGrantExactAlarm}
                  className="px-4 py-2 bg-amber-500 text-white text-xs font-semibold rounded-xl"
                >
                  Grant Permission
                </TouchFeedbackButton>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Info card ────────────────────────────────────────────── */}
        <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3 flex gap-3 items-start">
          <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700 leading-relaxed">
            Reminder times are auto-set <strong>{REMINDER_OFFSET} minutes before</strong> your
            activity window (from the Discipline Report). You can adjust them below.
          </p>
        </div>

        {/* ── Master Toggle card ───────────────────────────────────── */}
        {prefs && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center
                  ${prefs.masterEnabled ? 'bg-green-100' : 'bg-gray-100'}`}>
                  {prefs.masterEnabled
                    ? <Bell className="h-5 w-5 text-green-600" />
                    : <BellOff className="h-5 w-5 text-gray-400" />}
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">All Reminders</p>
                  <p className="text-xs text-gray-500">
                    {prefs.masterEnabled ? 'Notifications are on' : 'All notifications off'}
                  </p>
                </div>
              </div>
              <Toggle
                enabled={prefs.masterEnabled}
                onChange={setMaster}
              />
            </div>
          </div>
        )}

        {/* ── Per-activity cards ───────────────────────────────────── */}
        {prefs && ACTIVITY_TYPES.map((type) => {
          const activity = prefs.activities[type];
          if (!activity) return null;

          const cfg         = ACTIVITY_CONFIG[type];
          const Icon        = cfg.icon;
          const isEditing   = activePicker === type;
          const masterOff   = !prefs.masterEnabled;
          const defaultTime = getDefaultLabel(activity);

          return (
            <motion.div
              key={type}
              layout
              className={`bg-white rounded-2xl shadow-sm border transition-all
                ${isEditing
                  ? 'border-green-200 ring-1 ring-green-100 shadow-md overflow-visible z-10'
                  : 'border-gray-100 overflow-hidden'}
                ${masterOff ? 'opacity-50' : ''}`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Card header */}
              <div className="px-4 py-4 flex items-center gap-3">
                {/* Icon */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${cfg.bg} ${cfg.color}`}>
                  <Icon className="h-5 w-5" />
                </div>

                {/* Label + time */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900">{cfg.label}</p>
                  {activity.windowStart && (
                    <p className="text-[11px] text-gray-400 truncate">
                      Window starts{' '}
                      {(() => {
                        const p = parseTimeString(activity.windowStart);
                        return p ? formatReminderTime(p.hour, p.minute) : activity.windowStart;
                      })()}
                    </p>
                  )}
                </div>

                {/* Toggle */}
                <Toggle
                  enabled={activity.enabled}
                  onChange={(val) => setActivityEnabled(type, val)}
                  disabled={masterOff}
                />
              </div>

              {/* Time picker row (visible when activity enabled) */}
              <AnimatePresence>
                {activity.enabled && !masterOff && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-gray-50 px-4 pb-4 relative"
                  >
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mt-3 mb-2">
                      Reminder time
                    </p>

                    {/* Time selector button */}
                    <TouchFeedbackButton
                      onClick={(e) => {
                        e.stopPropagation();
                        setActivePicker(isEditing ? null : type);
                      }}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all
                        ${isEditing
                          ? 'bg-green-50 border-green-300 shadow-sm'
                          : 'bg-gray-50 border-gray-100 hover:border-gray-200'}`}
                    >
                      <div className="flex items-center gap-2">
                        <Clock className={`h-4 w-4 ${isEditing ? 'text-green-600' : 'text-gray-400'}`} />
                        <span className={`text-base font-bold ${isEditing ? 'text-green-700' : 'text-gray-800'}`}>
                          {formatReminderTime(activity.hour, activity.minute)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {defaultTime && (
                          <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                            default: {defaultTime}
                          </span>
                        )}
                        <ChevronDown
                          className={`h-4 w-4 text-gray-400 transition-transform ${isEditing ? 'rotate-180' : ''}`}
                        />
                      </div>
                    </TouchFeedbackButton>

                    {/* Scroll-wheel picker */}
                    <AnimatePresence>
                      {isEditing && (
                        <TimeScrollPicker
                          hour={activity.hour}
                          minute={activity.minute}
                          onChange={(h, m) => setActivityTime(type, h, m)}
                          onClose={() => setActivePicker(null)}
                        />
                      )}
                    </AnimatePresence>

                    {/* "15 min before X" hint */}
                    {defaultTime && (
                      activity.hour !== (() => {
                        const p = parseTimeString(activity.windowStart);
                        if (!p) return activity.hour;
                        const d = subtractMinutes(p.hour, p.minute, REMINDER_OFFSET);
                        return d.hour;
                      })() ||
                      activity.minute !== (() => {
                        const p = parseTimeString(activity.windowStart);
                        if (!p) return activity.minute;
                        const d = subtractMinutes(p.hour, p.minute, REMINDER_OFFSET);
                        return d.minute;
                      })()
                    ) ? (
                      <p className="text-[10px] text-amber-600 mt-1.5 ml-1">
                        ✏️ Custom time set — default is {defaultTime}
                      </p>
                    ) : (
                      <p className="text-[10px] text-green-600 mt-1.5 ml-1">
                        ⏰ {REMINDER_OFFSET} min before{' '}
                        {cfg.label.toLowerCase()} window opens
                      </p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}

        {/* ── Web notice ───────────────────────────────────────────── */}
        {!isNative && (
          <div className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 flex gap-3 items-start">
            <Info className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
            <p className="text-xs text-gray-500 leading-relaxed">
              Local notifications work on the <strong>Android app</strong> only.
              Your preferences are saved and will apply when you use the Android app.
            </p>
          </div>
        )}
      </div>

      {/* ── Sticky Save Button ───────────────────────────────────────────── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-30 px-4 pb-6 pt-3"
        style={{ background: 'linear-gradient(to top, #e8f5e9 60%, transparent)' }}
      >
        <div className="max-w-lg mx-auto">
          <TouchFeedbackButton
            onClick={handleSave}
            disabled={saving || !prefs}
            className={`w-full py-3.5 rounded-2xl font-bold text-white shadow-lg transition-all
              ${saving
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700 active:bg-green-800 shadow-green-200'}`}
          >
            {saving ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving…
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Bell className="h-4 w-4" />
                Save Reminders
              </span>
            )}
          </TouchFeedbackButton>
        </div>
      </div>

      {/* ── Toast ────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2
              px-5 py-3 rounded-2xl shadow-xl text-sm font-semibold whitespace-nowrap
              ${toast.type === 'success'
                ? 'bg-green-600 text-white'
                : 'bg-red-500 text-white'}`}
          >
            {toast.type === 'success'
              ? <Check className="h-4 w-4 shrink-0" />
              : <AlertTriangle className="h-4 w-4 shrink-0" />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ReminderSettingsPage;
