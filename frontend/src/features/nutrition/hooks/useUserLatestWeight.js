/**
 * useUserLatestWeight — fetch latest weight (kg) + gender from the user profile.
 *
 * Gender is used for fat macro target (calorie% / 9). Re-fetches on tab
 * visibility change so profile / BPC edits are reflected without a reload.
 * Works for phone-only users (userId) as well as email login.
 *
 * @returns {{ latestWeight: number|null, gender: string|null }}
 */
import { useState, useEffect } from 'react';
import { fetchUserMacroProfile } from '../services/nutritionDashboard/userProfileApi';
import { isCaptureFlowBusy } from '../../../shared/services/captureFlowBusy';

export function useUserLatestWeight({ user, apiBaseUrl, enabled = true }) {
  const [latestWeight, setLatestWeight] = useState(null);
  const [gender, setGender] = useState(null);

  const email = (user?.email || user?.Email || '').trim() || null;
  const userId = user?.id || user?.UserId || user?.userId || null;

  useEffect(() => {
    if (!enabled) return undefined;
    if (!email && (userId == null || userId === '')) return undefined;

    let cancelled = false;
    const load = async () => {
      const profile = await fetchUserMacroProfile({
        apiBaseUrl,
        email: email || undefined,
        userId: email ? undefined : userId,
      });
      if (!cancelled) {
        setLatestWeight(profile.latestWeight);
        setGender(profile.gender);
      }
    };

    load();

    const handleVisibilityChange = () => {
      // Skip while Gallery/Camera → capture upload is in flight (connection budget).
      if (document.visibilityState === 'visible' && !isCaptureFlowBusy()) load();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [email, userId, apiBaseUrl, enabled]);

  return { latestWeight, gender };
}
