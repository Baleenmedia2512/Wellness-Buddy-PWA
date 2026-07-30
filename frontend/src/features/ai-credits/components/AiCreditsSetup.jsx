import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Save, Loader2, Sparkles, Check, Minus, Plus } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { getUserId } from '../../../shared/services/userIdentity';
import {
  fetchAiCreditsAdminConfig,
  saveAiCreditsAdminConfig,
} from '../services/aiCredits.api';

/**
 * Admin / developer AI Credits Setup — daily limit + AI Mode toggle.
 */
export default function AiCreditsSetup({ user, apiBaseUrl, onBack }) {
  const [dailyAiCredits, setDailyAiCredits] = useState(0);
  const [aiModeEnabled, setAiModeEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState(null);
  const savedFlashTimerRef = useRef(null);

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
          setDailyAiCredits(Number(data.dailyAiCredits) || 0);
          setAiModeEnabled(Boolean(data.aiModeEnabled));
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
      const data = await saveAiCreditsAdminConfig({
        requesterUserId: userId,
        requesterEmail: user?.email || null,
        dailyAiCredits,
        aiModeEnabled,
        apiBaseUrl,
      });
      if (data) {
        setDailyAiCredits(Number(data.dailyAiCredits) || 0);
        setAiModeEnabled(Boolean(data.aiModeEnabled));
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

            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-medium text-gray-800">AI Mode enabled</span>
              <button
                type="button"
                role="switch"
                aria-checked={aiModeEnabled}
                aria-label={aiModeEnabled ? 'Disable AI Mode' : 'Enable AI Mode'}
                onClick={() => setAiModeEnabled((prev) => !prev)}
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
                Deducted only on successful food recognition. Resets at midnight in each user&apos;s timezone.
                Click Save — the new daily limit applies today for all users.
              </span>
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
