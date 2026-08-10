/**
 * useUserLatestWeight — fetch latest weight (kg) + gender from the user profile.
 *
 * Gender is used for fat macro target (calorie% / 9). Re-fetches on tab
 * visibility change so profile / BPC edits are reflected without a reload.
 *
 * @returns {{ latestWeight: number|null, gender: string|null }}
 */
import { useState, useEffect } from 'react';
import { fetchUserMacroProfile } from '../services/nutritionDashboard/userProfileApi';
import { isCaptureFlowBusy } from '../../../shared/services/captureFlowBusy';

export function useUserLatestWeight({ user, apiBaseUrl, enabled = true }) {
  const [latestWeight, setLatestWeight] = useState(null);
  const [gender, setGender] = useState(null);

  useEffect(() => {
    if (!enabled || !user?.email) return undefined;

    let cancelled = false;
    const load = async () => {
      const profile = await fetchUserMacroProfile({ apiBaseUrl, email: user.email });
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
  }, [user?.email, apiBaseUrl, enabled]);

  return { latestWeight, gender };
}
