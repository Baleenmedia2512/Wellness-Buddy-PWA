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
  BookOpen,
  Coffee,
  Utensils,
  Moon,
  Clock,
  ChevronDown,
  AlertTriangle,
  Check,
  Info,
  Droplets,
  Sunrise,
} from 'lucide-react';
import BathroomScaleIcon from '../shared/components/icons/BathroomScaleIcon';
import { motion, AnimatePresence } from 'framer-motion';
import { Capacitor } from '@capacitor/core';
import TouchFeedbackButton from '../shared/components/TouchFeedbackButton';
import {
  ACTIVITY_TYPES,
  ACTIVITY_LABELS,
  REMINDER_OFFSET,
  WATER_INTERVAL_MIN,
  fetchTimeWindows,
  loadReminderPreferences,
  saveReminderPreferences,
  buildDefaultPreferences,
  mergePreferencesWithWindows,
  updateReminders,
  resetRemindersToDefaults,
  checkExactAlarmPermission,
  openExactAlarmSettings,
  formatReminderTime,
  subtractMinutes,
  parseTimeString,
  computeWaterReminderTimes,
  computeSleepReminderTime,
} from '../shared/services/reminderService';

// ── Activity icon/colour config ───────────────────────────────────────────────

const ACTIVITY_CONFIG = {
  weight: {
    label:    'Weight',
    icon:     BathroomScaleIcon,
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
  water: {
    label:    'Water',
    icon:     Droplets,
    color:    'text-cyan-600',
    bg:       'bg-cyan-50',
    ring:     'ring-cyan-200',
    dot:      'bg-cyan-500',
    light:    'bg-cyan-100',
  },
  sleep: {
    label:    'Sleep',
    icon:     Moon,
    color:    'text-violet-600',
    bg:       'bg-violet-50',
    ring:     'ring-violet-200',
    dot:      'bg-violet-500',
    light:    'bg-violet-100',
  },
};

// ── Tiny Toggle component ─────────────────────────────────────────────────────

const Toggle = ({ enabled, onChange, disabled = false }) => (
  <button
    onClick={() => !disabled && onChange(!enabled)}
    role="switch"
    aria-checked={enabled}
    style={{
      position: 'relative',
      display: 'inline-flex',
      alignItems: 'center',
      width: '36px',
      height: '20px',
      borderRadius: '10px',
      backgroundColor: enabled ? '#22c55e' : '#d1d5db',
      opacity: disabled ? 0.4 : 1,
      cursor: disabled ? 'not-allowed' : 'pointer',
      border: 'none',
      outline: 'none',
      padding: 0,
      flexShrink: 0,
      transition: 'background-color 0.2s',
      WebkitAppearance: 'none',
      boxShadow: 'none',
      minHeight: '20px',
    }}
  >
    <span
      style={{
        position: 'absolute',
        width: '14px',
        height: '14px',
        borderRadius: '50%',
        backgroundColor: '#ffffff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
        transition: 'transform 0.2s',
        transform: enabled ? 'translateX(19px)' : 'translateX(3px)',
      }}
    />
  </button>
);

// ── Scroll-wheel Time Picker ──────────────────────────────────────────────────

const TimeScrollPicker = ({ hour, minute, onChange, onClose }) => {
  // 12-hour display values: 1..12
  const displayHours = Array.from({ length: 12 }, (_, i) => i + 1);
  const minutes      = Array.from({ length: 60 }, (_, i) => i);

  // Convert 24h hour → 12h display & period
  const isPM         = hour >= 12;
  const display12    = hour % 12 === 0 ? 12 : hour % 12;

  const hoursRef   = useRef(null);
  const minutesRef = useRef(null);

  // Scroll to selected values on mount (12 items, index 0-based = display12 - 1)
  useEffect(() => {
    if (hoursRef.current) {
      hoursRef.current.scrollTop = (display12 - 1) * 44;
    }
    if (minutesRef.current) {
      minutesRef.current.scrollTop = minute * 44;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: listed deps would cause an infinite re-render
  }, []);

  // Convert selected 12h display + period → 24h and fire onChange
  function handleHourClick(h12) {
    let h24;
    if (isPM) {
      h24 = h12 === 12 ? 12 : h12 + 12;
    } else {
      h24 = h12 === 12 ? 0 : h12;
    }
    onChange(h24, minute);
  }

  function handlePeriodClick(period) {
    const newIsPM = period === 'PM';
    let h24;
    if (newIsPM) {
      h24 = display12 === 12 ? 12 : display12 + 12;
    } else {
      h24 = display12 === 12 ? 0 : display12;
    }
    onChange(h24, minute);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      onClick={(e) => e.stopPropagation()}
      className="absolute top-full left-0 right-0 z-50 mt-2 bg-white border border-gray-100 rounded-2xl shadow-2xl overflow-hidden"
    >
      <div className="px-4 pt-3 pb-2 border-b border-gray-100 flex items-center justify-between">
        <span className="text-xs font-bold text-gray-600 tracking-wide uppercase">Set Time</span>
        <button
          onClick={onClose}
          className="text-xs font-bold text-green-600 px-3 py-1 rounded-lg bg-green-50 hover:bg-green-100 active:bg-green-200 transition-colors"
        >
          ✓ Done
        </button>
      </div>

      <div className="flex h-44 p-3 gap-2">
        {/* Hours (1–12) */}
        <div
          ref={hoursRef}
          className="flex-1 flex flex-col gap-1 overflow-y-auto no-scrollbar"
          style={{ scrollSnapType: 'y mandatory' }}
        >
          <div className="text-[10px] font-bold text-gray-400 text-center sticky top-0 bg-white py-1 z-10 tracking-widest">
            HOUR
          </div>
          {displayHours.map((h) => (
            <button
              key={h}
              onClick={() => handleHourClick(h)}
              className={`py-2.5 rounded-xl text-sm font-semibold transition-all shrink-0
                ${h === display12
                  ? 'bg-green-500 text-white shadow-sm scale-105'
                  : 'text-gray-600 hover:bg-gray-50 active:bg-gray-100'}`}
            >
              {String(h).padStart(2, '0')}
            </button>
          ))}
        </div>

        <div className="flex flex-col items-center justify-center">
          <span className="text-lg font-bold text-gray-300 select-none">:</span>
        </div>

        {/* Minutes */}
        <div
          ref={minutesRef}
          className="flex-1 flex flex-col gap-1 overflow-y-auto no-scrollbar"
          style={{ scrollSnapType: 'y mandatory' }}
        >
          <div className="text-[10px] font-bold text-gray-400 text-center sticky top-0 bg-white py-1 z-10 tracking-widest">
            MIN
          </div>
          {minutes.map((m) => (
            <button
              key={m}
              onClick={() => onChange(hour, m)}
              className={`py-2.5 rounded-xl text-sm font-semibold transition-all shrink-0
                ${m === minute
                  ? 'bg-green-500 text-white shadow-sm scale-105'
                  : 'text-gray-600 hover:bg-gray-50 active:bg-gray-100'}`}
            >
              {String(m).padStart(2, '0')}
            </button>
          ))}
        </div>

        {/* AM / PM */}
        <div className="flex flex-col gap-1 justify-center items-center px-1">
          {['AM', 'PM'].map((period) => (
            <button
              key={period}
              onClick={() => handlePeriodClick(period)}
              className={`px-3 py-2.5 rounded-xl text-sm font-semibold transition-all
                ${(period === 'PM') === isPM
                  ? 'bg-green-500 text-white shadow-sm scale-105'
                  : 'text-gray-600 hover:bg-gray-50 active:bg-gray-100'}`}
            >
              {period}
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

  const isNative   = Capacitor.isNativePlatform();
  const isAndroid  = Capacitor.getPlatform() === 'android';

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

      // Check exact-alarm permission on Android 12+ only
      if (isAndroid) {
        const { canScheduleExact } = await checkExactAlarmPermission();
        setNeedsExactPerm(!canScheduleExact);
      }
    } catch (err) {
      console.error('[ReminderSettingsPage] Load error:', err);
      showToast('error', 'Failed to load reminder settings. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [isNative, isAndroid]);

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
      // Persist to localStorage so settings aren't lost
      saveReminderPreferences(prefs);
      showToast('error', 'Failed to schedule reminders. Please check notification permissions in Settings.');
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
  if (!activity?.windowEnd) return null;
  const parsed = parseTimeString(activity.windowEnd);
  if (!parsed) return null;
  const def = subtractMinutes(parsed.hour, parsed.minute, REMINDER_OFFSET);
  return formatReminderTime(def.hour, def.minute);
  }

  // ── Loading state ─────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex flex-col">
        <div className="bg-white/90 backdrop-blur-lg border-b border-green-100 px-4 py-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-100 rounded-full animate-pulse" />
          <div className="flex-1">
            <div className="h-4 w-36 bg-gray-100 rounded-lg animate-pulse mb-2" />
            <div className="h-3 w-28 bg-gray-100 rounded-lg animate-pulse" />
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-14 h-14 border-4 border-green-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm font-medium text-gray-500">Loading reminders…</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────

  return (
    <div
      className="min-h-screen flex flex-col pb-28"
      style={{ backgroundColor: '#f0faf2' }}
      onClick={() => setActivePicker(null)}
    >

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div
        className="sticky top-0 z-40 shadow-sm"
        style={{ background: 'linear-gradient(135deg, #4caf79 0%, #2e7d52 100%)' }}
      >
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TouchFeedbackButton
              onClick={onBack}
              className="p-2 -ml-1 rounded-full bg-white/20 active:bg-white/30 transition-colors"
              ariaLabel="Go back"
            >
              <ArrowLeft className="h-5 w-5 text-white" />
            </TouchFeedbackButton>
            <div>
              <h1 className="text-lg font-bold text-white leading-tight">
                Reminders
              </h1>
              <p className="text-xs text-green-100">
                Daily activity notifications
              </p>
            </div>
          </div>

          {/* Reset button */}
          <TouchFeedbackButton
            onClick={handleReset}
            disabled={resetting}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/20 active:bg-white/30 text-white text-xs font-semibold transition-colors"
            ariaLabel="Reset to defaults"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${resetting ? 'animate-spin' : ''}`} />
            {resetting ? 'Resetting…' : 'Reset'}
          </TouchFeedbackButton>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────── */}
      <div className="max-w-lg mx-auto w-full px-4 pt-5 space-y-3">

        {/* ── Exact-alarm permission banner (Android 12 only) ──────── */}
        <AnimatePresence>
          {isAndroid && needsExactPerm && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3"
            >
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-bold text-amber-800 mb-1">
                  Exact Alarm Permission Needed
                </p>
                <p className="text-xs text-amber-700 mb-3 leading-relaxed">
                  For precise reminder times, please grant exact alarm
                  permission in Settings. Reminders will still work
                  but may arrive a few minutes late without it.
                </p>
                <TouchFeedbackButton
                  onClick={handleGrantExactAlarm}
                  className="px-4 py-2 bg-amber-500 text-white text-xs font-bold rounded-xl active:bg-amber-600"
                >
                  Open Settings
                </TouchFeedbackButton>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Master Toggle card ───────────────────────────────────── */}
        {prefs && (
          <div className={`rounded-2xl shadow-sm border px-4 py-4 flex items-center justify-between transition-all
            ${prefs.masterEnabled
              ? 'bg-green-600 border-green-500'
              : 'bg-white border-gray-100'}`}>
            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center
                ${prefs.masterEnabled ? 'bg-white/20' : 'bg-gray-100'}`}>
                {prefs.masterEnabled
                  ? <Bell className="h-5 w-5 text-white" />
                  : <BellOff className="h-5 w-5 text-gray-400" />}
              </div>
              <div>
                <p className={`text-sm font-bold ${prefs.masterEnabled ? 'text-white' : 'text-gray-900'}`}>
                  All Reminders
                </p>
                <p className={`text-xs ${prefs.masterEnabled ? 'text-green-100' : 'text-gray-500'}`}>
                  {prefs.masterEnabled ? 'Notifications are on ✓' : 'All notifications off'}
                </p>
              </div>
            </div>
            <Toggle enabled={prefs.masterEnabled} onChange={setMaster} />
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
              className={`bg-white rounded-2xl shadow-sm border transition-all duration-200
                ${isEditing ? 'border-green-300 ring-2 ring-green-100 shadow-md' : 'border-gray-100'}
                ${masterOff ? 'opacity-50' : ''}
                ${isEditing ? 'overflow-visible z-10' : 'overflow-hidden'}`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Card header */}
              <div className="px-4 py-4 flex items-center gap-3">
                {/* Icon */}
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${cfg.bg}`}>
                  <Icon className={`h-5 w-5 ${cfg.color}`} />
                </div>

                {/* Label + window time */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900">{cfg.label}</p>
                  {activity.enabled && !masterOff ? (
                    <p className="text-xs font-semibold text-green-600">
                      🔔 {formatReminderTime(activity.hour, activity.minute)}
                    </p>
                  ) : (
                    activity.windowStart && (
                      <p className="text-xs text-gray-400 truncate">
                        Window: {(() => {
                          const p = parseTimeString(activity.windowStart);
                          return p ? formatReminderTime(p.hour, p.minute) : activity.windowStart;
                        })()}
                      </p>
                    )
                  )}
                </div>

                {/* Toggle */}
                <Toggle
                  enabled={activity.enabled}
                  onChange={(val) => setActivityEnabled(type, val)}
                  disabled={masterOff}
                />
              </div>

              {/* Time picker row */}
              <AnimatePresence>
                {activity.enabled && !masterOff && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-gray-50 px-4 pb-4 relative"
                  >
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-3 mb-2">
                      Reminder Time
                    </p>

                    {/* Time selector button */}
                    <TouchFeedbackButton
                      onClick={(e) => {
                        e.stopPropagation();
                        setActivePicker(isEditing ? null : type);
                      }}
                      className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl border-2 transition-all
                        ${isEditing
                          ? 'bg-green-50 border-green-400 shadow-sm'
                          : 'bg-gray-50 border-gray-100 active:border-gray-200'}`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center
                          ${isEditing ? 'bg-green-100' : 'bg-white shadow-sm'}`}>
                          <Clock className={`h-4 w-4 ${isEditing ? 'text-green-600' : 'text-gray-400'}`} />
                        </div>
                        <span className={`text-lg font-bold tracking-tight ${isEditing ? 'text-green-700' : 'text-gray-800'}`}>
                          {formatReminderTime(activity.hour, activity.minute)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {defaultTime && (
                          <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full hidden sm:block">
                            default: {defaultTime}
                          </span>
                        )}
                        <ChevronDown
                          className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${isEditing ? 'rotate-180' : ''}`}
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

                    {/* hint row */}
                    {(() => {
                      if (!defaultTime) return null;
                      const p = parseTimeString(activity.windowEnd);
                      if (!p) return null;
                      const d = subtractMinutes(p.hour, p.minute, REMINDER_OFFSET);
                      const isCustom = activity.hour !== d.hour || activity.minute !== d.minute;
                      return (
                        <p className={`text-[11px] font-medium mt-2 ml-1
                          ${isCustom ? 'text-amber-600' : 'text-green-600'}`}>
                          {isCustom
                            ? `✏️ Custom — default is ${defaultTime}`
                            : `⏰ ${REMINDER_OFFSET} min before ${cfg.label.toLowerCase()} window`}
                        </p>
                      );
                    })()}
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
              Alarms work on the <strong>Android</strong> and <strong>iOS</strong> apps only.
              Preferences saved here will apply when you open the app.
            </p>
          </div>
        )}

        {/* ── 💧 Water Reminders Card ───────────────────────────────── */}
        {prefs && (() => {
          const water     = prefs.water || {};
          const masterOff = !prefs.masterEnabled;
          const wakeH     = water.wakeHour   ?? 6;
          const wakeM     = water.wakeMinute ?? 0;
          const sleepH    = water.sleepHour  ?? 22;
          const sleepM    = water.sleepMinute ?? 0;
          const slots     = computeWaterReminderTimes(wakeH, wakeM, sleepH, sleepM);
          const isEditingWake  = activePicker === 'water_wake';
          const isEditingSleep = activePicker === 'water_sleep';
          return (
            <motion.div layout
              className={`bg-white rounded-2xl shadow-sm border transition-all duration-200
                ${(isEditingWake||isEditingSleep) ? 'border-cyan-300 ring-2 ring-cyan-100 shadow-md' : 'border-gray-100'}
                ${masterOff ? 'opacity-50' : ''}`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-4 py-4 flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-cyan-50">
                  <Droplets className="h-5 w-5 text-cyan-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900">Water</p>
                  {water.enabled && !masterOff
                    ? <p className="text-xs font-semibold text-cyan-600">💧 Every {WATER_INTERVAL_MIN} min · {slots.length} reminders/day</p>
                    : <p className="text-xs text-gray-400">Stay hydrated throughout the day</p>}
                </div>
                <Toggle enabled={!!water.enabled}
                  onChange={(val) => setPrefs((prev) => ({ ...prev, water: { ...prev.water, enabled: val } }))}
                  disabled={masterOff} />
              </div>
              <AnimatePresence>
                {water.enabled && !masterOff && (
                  <motion.div initial={{ height:0, opacity:0 }} animate={{ height:'auto', opacity:1 }} exit={{ height:0, opacity:0 }}
                    className="border-t border-gray-50 px-4 pb-4">
                    <div className="flex gap-3 mt-3">
                      <div className="flex-1">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Wake Up</p>
                        <TouchFeedbackButton
                          onClick={(e) => { e.stopPropagation(); setActivePicker(isEditingWake ? null : 'water_wake'); }}
                          className={`w-full flex items-center justify-between px-3 py-3 rounded-xl border-2 transition-all
                            ${isEditingWake ? 'bg-cyan-50 border-cyan-400' : 'bg-gray-50 border-gray-100'}`}>
                          <div className="flex items-center gap-2">
                            <Sunrise className={`h-4 w-4 ${isEditingWake ? 'text-cyan-600' : 'text-gray-400'}`} />
                            <span className={`text-sm font-bold ${isEditingWake ? 'text-cyan-700' : 'text-gray-800'}`}>{formatReminderTime(wakeH, wakeM)}</span>
                          </div>
                          <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isEditingWake ? 'rotate-180' : ''}`} />
                        </TouchFeedbackButton>
                        <AnimatePresence>
                          {isEditingWake && (
                            <TimeScrollPicker hour={wakeH} minute={wakeM}
                              onChange={(h,m) => setPrefs((prev) => ({ ...prev, water: { ...prev.water, wakeHour:h, wakeMinute:m } }))}
                              onClose={() => setActivePicker(null)} />
                          )}
                        </AnimatePresence>
                      </div>
                      <div className="flex-1">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Sleep</p>
                        <TouchFeedbackButton
                          onClick={(e) => { e.stopPropagation(); setActivePicker(isEditingSleep ? null : 'water_sleep'); }}
                          className={`w-full flex items-center justify-between px-3 py-3 rounded-xl border-2 transition-all
                            ${isEditingSleep ? 'bg-cyan-50 border-cyan-400' : 'bg-gray-50 border-gray-100'}`}>
                          <div className="flex items-center gap-2">
                            <Moon className={`h-4 w-4 ${isEditingSleep ? 'text-cyan-600' : 'text-gray-400'}`} />
                            <span className={`text-sm font-bold ${isEditingSleep ? 'text-cyan-700' : 'text-gray-800'}`}>{formatReminderTime(sleepH, sleepM)}</span>
                          </div>
                          <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isEditingSleep ? 'rotate-180' : ''}`} />
                        </TouchFeedbackButton>
                        <AnimatePresence>
                          {isEditingSleep && (
                            <TimeScrollPicker hour={sleepH} minute={sleepM}
                              onChange={(h,m) => setPrefs((prev) => ({ ...prev, water: { ...prev.water, sleepHour:h, sleepMinute:m } }))}
                              onClose={() => setActivePicker(null)} />
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                    <p className="text-[11px] font-medium mt-3 ml-1 text-cyan-600">
                      {slots.length > 0
                        ? `⏱ First 3: ${slots.slice(0,3).map(t => formatReminderTime(t.hour, t.minute)).join(', ')}${slots.length > 3 ? ` … +${slots.length-3} more` : ''}`
                        : '⚠️ Increase gap between wake and sleep times'}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })()}

        {/* ── 🌙 Sleep Reminder Card ────────────────────────────────── */}
        {prefs && (() => {
          const sleep     = prefs.sleep || {};
          const masterOff = !prefs.masterEnabled;
          const bedH      = sleep.bedHour   ?? 22;
          const bedM      = sleep.bedMinute ?? 0;
          const remTime   = computeSleepReminderTime(bedH, bedM);
          const isEditing = activePicker === 'sleep';
          return (
            <motion.div layout
              className={`bg-white rounded-2xl shadow-sm border transition-all duration-200
                ${isEditing ? 'border-violet-300 ring-2 ring-violet-100 shadow-md' : 'border-gray-100'}
                ${masterOff ? 'opacity-50' : ''}`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-4 py-4 flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-violet-50">
                  <Moon className="h-5 w-5 text-violet-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900">Sleep</p>
                  {sleep.enabled && !masterOff
                    ? <p className="text-xs font-semibold text-violet-600">🌙 {formatReminderTime(remTime.hour, remTime.minute)} — 15 min before bed</p>
                    : <p className="text-xs text-gray-400">Bedtime wind-down reminder</p>}
                </div>
                <Toggle enabled={!!sleep.enabled}
                  onChange={(val) => setPrefs((prev) => ({ ...prev, sleep: { ...prev.sleep, enabled: val } }))}
                  disabled={masterOff} />
              </div>
              <AnimatePresence>
                {sleep.enabled && !masterOff && (
                  <motion.div initial={{ height:0, opacity:0 }} animate={{ height:'auto', opacity:1 }} exit={{ height:0, opacity:0 }}
                    className="border-t border-gray-50 px-4 pb-4">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-3 mb-2">Bedtime</p>
                    <TouchFeedbackButton
                      onClick={(e) => { e.stopPropagation(); setActivePicker(isEditing ? null : 'sleep'); }}
                      className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl border-2 transition-all
                        ${isEditing ? 'bg-violet-50 border-violet-400 shadow-sm' : 'bg-gray-50 border-gray-100'}`}>
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isEditing ? 'bg-violet-100' : 'bg-white shadow-sm'}`}>
                          <Moon className={`h-4 w-4 ${isEditing ? 'text-violet-600' : 'text-gray-400'}`} />
                        </div>
                        <span className={`text-lg font-bold tracking-tight ${isEditing ? 'text-violet-700' : 'text-gray-800'}`}>
                          {formatReminderTime(bedH, bedM)}
                        </span>
                      </div>
                      <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${isEditing ? 'rotate-180' : ''}`} />
                    </TouchFeedbackButton>
                    <AnimatePresence>
                      {isEditing && (
                        <TimeScrollPicker hour={bedH} minute={bedM}
                          onChange={(h,m) => setPrefs((prev) => ({ ...prev, sleep: { ...prev.sleep, bedHour:h, bedMinute:m } }))}
                          onClose={() => setActivePicker(null)} />
                      )}
                    </AnimatePresence>
                    <p className="text-[11px] font-medium mt-2 ml-1 text-violet-600">
                      🌙 Reminder at {formatReminderTime(remTime.hour, remTime.minute)} — 15 min before {formatReminderTime(bedH, bedM)}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })()}
      </div>

      {/* ── Sticky Save Button ───────────────────────────────────────────── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-30 px-4 pb-6 pt-4"
        style={{ background: 'linear-gradient(to top, #f0faf2 65%, transparent)' }}
      >
        <div className="max-w-lg mx-auto">
          <TouchFeedbackButton
            onClick={handleSave}
            disabled={saving || !prefs}
            className={`w-full py-4 rounded-2xl font-bold text-base text-white shadow-lg transition-all
              ${saving
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-green-600 active:bg-green-700 shadow-green-200'}`}
          >
            {saving ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving…
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Bell className="h-5 w-5" />
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
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            className={`fixed bottom-28 left-4 right-4 max-w-sm mx-auto z-50 flex items-center gap-3
              px-5 py-3.5 rounded-2xl shadow-2xl text-sm font-bold
              ${toast.type === 'success'
                ? 'bg-green-600 text-white'
                : 'bg-red-500 text-white'}`}
          >
            {toast.type === 'success'
              ? <Check className="h-5 w-5 shrink-0" />
              : <AlertTriangle className="h-5 w-5 shrink-0" />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ReminderSettingsPage;
