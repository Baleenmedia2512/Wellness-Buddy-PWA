import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Save, Loader2, Sparkles, Check, Minus, Plus, Coffee, Utensils, Moon, AlertTriangle } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { getUserId } from '../../../shared/services/userIdentity';
import {
  fetchAiCreditsAdminConfig,
  saveAiCreditsAdminConfig,
} from '../services/aiCredits.api';

const DEFAULT_WINDOWS = {
  breakfast: { enabled: true, start: '05:30', end: '08:30' },
  lunch: { enabled: true, start: '12:00', end: '16:00' },
  dinner: { enabled: true, start: '17:30', end: '20:30' },
};

const MEAL_TABS = [
  { key: 'breakfast', label: 'Breakfast', icon: Coffee },
  { key: 'lunch', label: 'Lunch', icon: Utensils },
  { key: 'dinner', label: 'Dinner', icon: Moon },
];

/** "HH:MM:SS" | "HH:MM" → "HH:MM" for <input type="time"> */
function toInputTime(value, fallback) {
  const raw = String(value || fallback || '00:00');
  const parts = raw.split(':');
  if (parts.length < 2) return fallback || '00:00';
  return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
}

/** "HH:MM" → "HH:MM:SS" for API */
function toApiTime(value) {
  const t = toInputTime(value, '00:00');
  return `${t}:00`;
}

function normalizeWindowsFromApi(raw) {
  const out = {};
  for (const { key } of MEAL_TABS) {
    const def = DEFAULT_WINDOWS[key];
    const src = raw?.[key];
    out[key] = {
      enabled: src?.enabled === undefined ? def.enabled : Boolean(src.enabled),
      start: toInputTime(src?.start, def.start),
      end: toInputTime(src?.end, def.end),
    };
  }
  return out;
}

function windowsToApi(windows) {
  const out = {};
  for (const { key } of MEAL_TABS) {
    const slot = windows[key] || DEFAULT_WINDOWS[key];
    out[key] = {
      enabled: Boolean(slot.enabled),
      start: toApiTime(slot.start),
      end: toApiTime(slot.end),
    };
  }
  return out;
}

function hasAnyMealSlotOn(windows) {
  return MEAL_TABS.some(({ key }) => Boolean(windows?.[key]?.enabled));
}

/**
 * Admin / developer AI Credits Setup — daily limit, AI Mode, meal availability tabs.
 */
export default function AiCreditsSetup({ user, apiBaseUrl, onBack }) {
  const [dailyAiCredits, setDailyAiCredits] = useState(0);
  const [aiModeEnabled, setAiModeEnabled] = useState(true);
  const [availabilityWindows, setAvailabilityWindows] = useState(DEFAULT_WINDOWS);
  const [activeMealTab, setActiveMealTab] = useState('lunch');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState(null);
  const savedFlashTimerRef = useRef(null);

  const anyMealSlotOn = hasAnyMealSlotOn(availabilityWindows);

  useEffect(() => () => {
    if (savedFlashTimerRef.current) clearTimeout(savedFlashTimerRef.current);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const userId = (await getUserId(user)) || user?.id;
        if (!userId && !user?.email) throw new Error('Unable to resolve user');
        const data = await fetchAiCreditsAdminConfig({
          requesterUserId: userId,
          requesterEmail: user?.email || null,
          apiBaseUrl,
        });
        if (!cancelled && data) {
          const windows = normalizeWindowsFromApi(data.availabilityWindows);
          setDailyAiCredits(Number(data.dailyAiCredits) || 0);
          setAvailabilityWindows(windows);
          // AI Mode cannot stay On when every meal slot is Off.
          setAiModeEnabled(Boolean(data.aiModeEnabled) && hasAnyMealSlotOn(windows));
        }
      } catch (err) {
        if (!cancelled) setError(err?.message || 'Failed to load configuration');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, apiBaseUrl]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const userId = (await getUserId(user)) || user?.id;
      const effectiveMode = Boolean(aiModeEnabled) && hasAnyMealSlotOn(availabilityWindows);
      const data = await saveAiCreditsAdminConfig({
        requesterUserId: userId,
        requesterEmail: user?.email || null,
        dailyAiCredits,
        aiModeEnabled: effectiveMode,
        availabilityWindows: windowsToApi(availabilityWindows),
        apiBaseUrl,
      });
      if (data) {
        const windows = normalizeWindowsFromApi(data.availabilityWindows);
        setDailyAiCredits(Number(data.dailyAiCredits) || 0);
        setAvailabilityWindows(windows);
        setAiModeEnabled(Boolean(data.aiModeEnabled) && hasAnyMealSlotOn(windows));
      }
      setSavedFlash(true);
      if (savedFlashTimerRef.current) clearTimeout(savedFlashTimerRef.current);
      savedFlashTimerRef.current = setTimeout(() => setSavedFlash(false), 2200);
    } catch (err) {
      setError(err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const MAX_DAILY_AI_CREDITS = 1000;

  const decrementCredits = () => {
    setDailyAiCredits((prev) => Math.max(0, prev - 1));
  };

  const incrementCredits = () => {
    setDailyAiCredits((prev) => Math.min(MAX_DAILY_AI_CREDITS, prev + 1));
  };

  const toggleAiMode = () => {
    setAiModeEnabled((prev) => {
      if (prev) return false;
      if (!hasAnyMealSlotOn(availabilityWindows)) {
        setError('Turn on at least one meal slot (Breakfast, Lunch, or Dinner) before enabling AI Mode.');
        return false;
      }
      setError(null);
      return true;
    });
  };

  const updateActiveSlot = (patch) => {
    setAvailabilityWindows((prev) => {
      const next = {
        ...prev,
        [activeMealTab]: {
          ...prev[activeMealTab],
          ...patch,
        },
      };
      // Last meal slot turned Off → AI Mode must go Off.
      if (!hasAnyMealSlotOn(next)) {
        setAiModeEnabled(false);
      }
      return next;
    });
  };

  const activeSlot = availabilityWindows[activeMealTab] || DEFAULT_WINDOWS[activeMealTab];

  return (
    <div className="min-h-screen bg-[#f4f7f5]">
      <header className="sticky top-0 z-20 border-b border-gray-200/80 bg-white/95 backdrop-blur safe-top">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="-ml-2 rounded-lg p-2 transition-colors hover:bg-gray-100"
              aria-label="Back"
            >
              <ArrowLeft className="h-5 w-5 text-gray-700" />
            </button>
          )}
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Sparkles className="h-5 w-5 shrink-0 text-emerald-600" />
            <h1 className="truncate text-lg font-semibold text-gray-900">AI Credits Setup</h1>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50 ${
              savedFlash ? 'bg-emerald-700' : 'bg-emerald-600'
            }`}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : savedFlash ? (
              <Check className="h-4 w-4" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {savedFlash ? 'Saved!' : 'Save'}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-6">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          </div>
        ) : (
          <div className="space-y-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}

            <div className="space-y-1">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm font-medium text-gray-800">AI Mode enabled</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={aiModeEnabled}
                  aria-label={aiModeEnabled ? 'Disable AI Mode' : 'Enable AI Mode'}
                  onClick={toggleAiMode}
                  className="shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1"
                >
                  <span
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
                      aiModeEnabled ? 'bg-emerald-500' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200 ${
                        aiModeEnabled ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                    />
                  </span>
                </button>
              </div>
              {!anyMealSlotOn && (
                <p className="text-xs text-amber-700">
                  All meal slots are Off — AI Mode stays Off until you enable Breakfast, Lunch, or Dinner.
                </p>
              )}
              {anyMealSlotOn && !aiModeEnabled && (
                <div
                  role="status"
                  className="mt-2 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
                  <p className="leading-relaxed">
                    <span className="font-semibold">AI is Off for users.</span>
                    {' '}Meal windows are set, but <span className="font-semibold">AI Mode</span> is
                    disabled — turn AI Mode On and Save for AI to run in those windows.
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <span className="text-sm font-medium text-gray-800">Daily AI credits per user</span>
              <div className="flex items-center justify-center gap-4 rounded-xl border border-gray-200 bg-gray-50/80 px-4 py-3">
                <button
                  type="button"
                  onClick={decrementCredits}
                  disabled={dailyAiCredits <= 0}
                  aria-label="Decrease daily AI credits"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-gray-200 bg-white text-gray-700 transition-colors hover:border-emerald-400 hover:text-emerald-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <Minus className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" />
                </button>
                <span
                  className="min-w-[3rem] text-center text-2xl font-bold tabular-nums text-gray-900"
                  aria-live="polite"
                  aria-label={`${dailyAiCredits} daily AI credits`}
                >
                  {dailyAiCredits}
                </span>
                <button
                  type="button"
                  onClick={incrementCredits}
                  disabled={dailyAiCredits >= MAX_DAILY_AI_CREDITS}
                  aria-label="Increase daily AI credits"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-emerald-200 bg-emerald-50 text-emerald-700 transition-colors hover:border-emerald-400 hover:bg-emerald-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <Plus className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" />
                </button>
              </div>
              <span className="block text-xs text-gray-500">
                Deducted when AI finishes a classification (including unrecognised photos).
                Not deducted on technical failures (timeout / server error).
                Resets at midnight. Click Save — changes apply today for all users.
              </span>
            </div>

            <div className="space-y-3 border-t border-gray-100 pt-5">
              <div>
                <span className="text-sm font-medium text-gray-800">AI availability windows</span>
                <p className="mt-1 text-xs text-gray-500">
                  Choose which meal slots allow AI, and set custom times (IST). Outside enabled
                  windows AI is blocked — manual log only.
                </p>
              </div>

              <div
                role="tablist"
                aria-label="Meal availability"
                className="grid grid-cols-3 gap-1 rounded-xl bg-gray-100 p-1"
              >
                {MEAL_TABS.map(({ key, label, icon: Icon }) => {
                  const on = availabilityWindows[key]?.enabled;
                  const selected = activeMealTab === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      onClick={() => setActiveMealTab(key)}
                      className={`flex flex-col items-center gap-0.5 rounded-lg px-1 py-2 text-xs font-semibold transition-colors ${
                        selected
                          ? 'bg-white text-emerald-700 shadow-sm'
                          : 'text-gray-600 hover:text-gray-800'
                      }`}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                      <span>{label}</span>
                      <span className={`text-[10px] font-medium ${on ? 'text-emerald-600' : 'text-gray-400'}`}>
                        {on ? 'On' : 'Off'}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="space-y-4 rounded-xl border border-gray-200 bg-gray-50/80 p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-gray-800">
                    Enable {MEAL_TABS.find((t) => t.key === activeMealTab)?.label}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={Boolean(activeSlot.enabled)}
                    aria-label={`Toggle ${activeMealTab} AI window`}
                    onClick={() => updateActiveSlot({ enabled: !activeSlot.enabled })}
                    className="shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1"
                  >
                    <span
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
                        activeSlot.enabled ? 'bg-emerald-500' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200 ${
                          activeSlot.enabled ? 'translate-x-5' : 'translate-x-0.5'
                        }`}
                      />
                    </span>
                  </button>
                </div>

                <div className={`grid grid-cols-2 gap-3 ${activeSlot.enabled ? '' : 'opacity-50'}`}>
                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-gray-600">Start</span>
                    <input
                      type="time"
                      value={activeSlot.start}
                      disabled={!activeSlot.enabled}
                      onChange={(e) => updateActiveSlot({ start: e.target.value })}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 disabled:cursor-not-allowed"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-gray-600">End</span>
                    <input
                      type="time"
                      value={activeSlot.end}
                      disabled={!activeSlot.enabled}
                      onChange={(e) => updateActiveSlot({ end: e.target.value })}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 disabled:cursor-not-allowed"
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <AnimatePresence>
        {savedFlash && (
          <motion.div
            role="status"
            aria-live="polite"
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ type: 'spring', damping: 22, stiffness: 320 }}
            className="pointer-events-none fixed left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-gray-900/95 px-4 py-2.5 text-sm font-medium text-white shadow-xl backdrop-blur-sm"
            style={{ bottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500">
              <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} aria-hidden="true" />
            </span>
            AI settings updated
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
