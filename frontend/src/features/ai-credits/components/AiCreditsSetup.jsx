import React, { useEffect, useState } from 'react';
import { ArrowLeft, Save, Loader2, Sparkles } from 'lucide-react';
import { getUserId } from '../../../shared/services/userIdentity';
import {
  fetchAiCreditsAdminConfig,
  saveAiCreditsAdminConfig,
} from '../services/aiCredits.api';

/**
 * Admin / developer AI Credits Setup — daily limit + AI Mode toggle.
 */
export default function AiCreditsSetup({ user, apiBaseUrl, onBack }) {
  const [dailyAiCredits, setDailyAiCredits] = useState(3);
  const [aiModeEnabled, setAiModeEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState(null);

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
      setTimeout(() => setSavedFlash(false), 2500);
    } catch (err) {
      setError(err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
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
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
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
            {savedFlash && (
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                Configuration saved.
              </p>
            )}

            <label className="flex items-center justify-between gap-4">
              <span className="text-sm font-medium text-gray-800">AI Mode enabled</span>
              <input
                type="checkbox"
                checked={aiModeEnabled}
                onChange={(e) => setAiModeEnabled(e.target.checked)}
                className="h-5 w-5 rounded border-gray-300 text-emerald-600"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-gray-800">Daily AI credits per user</span>
              <input
                type="number"
                min={0}
                max={1000}
                value={dailyAiCredits}
                onChange={(e) => setDailyAiCredits(Number(e.target.value))}
                className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-base outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
              <span className="block text-xs text-gray-500">
                Deducted only on successful food recognition. Resets at midnight in each user&apos;s timezone.
              </span>
            </label>
          </div>
        )}
      </main>
    </div>
  );
}
