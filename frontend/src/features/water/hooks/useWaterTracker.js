/**
 * useWaterTracker.js
 * Owns all state, side-effects and derived values for the water tracker.
 * Components consuming this hook only render — no calculations, no fetch.
 *
 * Returns a viewmodel with pre-formatted display strings so components stay dumb.
 */
import { useState, useCallback, useEffect } from 'react';
import {
  todayLocal,
  formatMl,
  getCachedUserId,
  getCachedUserEmail,
  resolveUserIdByEmail,
  fetchWaterIntake,
  logWaterIntake,
} from '../services/waterStorageService';

const SUCCESS_TOAST_MS = 3000;

export function useWaterTracker({ user, userId: propUserId } = {}) {
  const [resolvedUserId, setResolvedUserId] = useState(propUserId || null);
  const [waterData, setWaterData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(null);
  const [customMl, setCustomMl] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  // ── Resolve userId (prop > localStorage > /api/user/lookup) ──────────────
  useEffect(() => {
    if (propUserId) {
      setResolvedUserId(propUserId);
      return;
    }
    const cached = getCachedUserId();
    if (cached) {
      setResolvedUserId(cached);
      return;
    }
    const email = user?.email || getCachedUserEmail();
    if (email) {
      resolveUserIdByEmail(email)
        .then((id) => { if (id) setResolvedUserId(id); })
        .catch(() => {});
    }
  }, [propUserId, user]);

  // ── Fetch ────────────────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    if (!resolvedUserId) return null;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWaterIntake(resolvedUserId, todayLocal());
      setWaterData(data);
      return data;
    } catch (err) {
      console.error('[useWaterTracker] refresh error:', err);
      setError('Failed to load water data. Please try again.');
      return null;
    } finally {
      setLoading(false);
    }
  }, [resolvedUserId]);

  useEffect(() => { if (resolvedUserId) refresh(); }, [resolvedUserId, refresh]);

  // ── Log water ────────────────────────────────────────────────────────────
  const logWater = useCallback(
    async (ml) => {
      if (!resolvedUserId || saving) return;
      setSaving(true);
      setError(null);
      setSaveSuccess(null);
      try {
        await logWaterIntake({
          userId: resolvedUserId,
          ml,
          userEmail: user?.email || getCachedUserEmail(),
        });
        setSaveSuccess({ amount: ml });
        await refresh();
      } catch (err) {
        console.error('[useWaterTracker] logWater error:', err);
        setError(err.message || 'Failed to log water. Please try again.');
      } finally {
        setSaving(false);
        setTimeout(() => setSaveSuccess(null), SUCCESS_TOAST_MS);
      }
    },
    [resolvedUserId, saving, user, refresh],
  );

  const submitCustom = useCallback(() => {
    const ml = parseInt(customMl, 10);
    if (!ml || ml <= 0) { setError('Enter a valid amount in ml.'); return; }
    setCustomMl('');
    setShowCustom(false);
    logWater(ml);
  }, [customMl, logWater]);

  // ── Derived viewmodel ────────────────────────────────────────────────────
  const totalMl = waterData?.totalMl ?? 0;
  const requiredMl = waterData?.requiredMl ?? 2500;
  const remainingMl = waterData?.remainingMl ?? requiredMl;
  const achieved = waterData?.achieved ?? false;
  const progressPercent = waterData?.progressPercent ?? 0;
  const defaultWeight = waterData?.defaultWeight ?? true;
  const weightKg = waterData?.weightKg ?? null;

  const goalSubtitle = defaultWeight
    ? 'Goal: 2.5 L (default — log your weight for a custom goal)'
    : `Goal: ${formatMl(requiredMl)} (based on ${weightKg} kg)`;

  const logs = (waterData?.logs || []).map((log) => ({
    key: log.loggedAt,
    timeLabel: new Date(log.loggedAt).toLocaleTimeString([], {
      hour: '2-digit', minute: '2-digit',
    }),
    volumeLabel: formatMl(log.volumeMl),
  }));

  return {
    // status
    loading, saving, error,
    saveSuccessLabel: saveSuccess ? `+${formatMl(saveSuccess.amount)} logged successfully!` : null,
    hasData: Boolean(waterData),
    // progress
    totalLabel: formatMl(totalMl),
    requiredLabel: formatMl(requiredMl),
    remainingLabel: formatMl(remainingMl),
    progressPercent, achieved, goalSubtitle,
    // history
    logs,
    // custom-input controls
    customMl, setCustomMl, showCustom,
    openCustom: () => setShowCustom(true),
    closeCustom: () => { setShowCustom(false); setCustomMl(''); },
    submitCustom,
    // actions
    refresh, logWater,
  };
}
