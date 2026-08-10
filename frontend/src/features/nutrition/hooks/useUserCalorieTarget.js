/**
 * useUserCalorieTarget — fetch the user's TDEE-based daily calorie target.
 *
 * Wraps fetchUserCalorieTarget() with a useEffect that re-runs on email/apiBaseUrl/
 * bmrUpdateKey change AND on tab visibility change (so editing BMR or activity in the
 * profile screen and returning to nutrition picks up the new value).
 */
import { useState, useEffect } from 'react';
import { fetchUserCalorieTarget, DEFAULT_CALORIE_TARGET } from '../services/nutritionDashboard';
import { isCaptureFlowBusy } from '../../../shared/services/captureFlowBusy';

export function useUserCalorieTarget({ user, apiBaseUrl, bmrUpdateKey = 0, enabled = true }) {
  const [calorieTarget, setCalorieTarget] = useState(DEFAULT_CALORIE_TARGET);
  const [bmrLoading, setBmrLoading] = useState(true);

  useEffect(() => {
    if (!enabled) {
      setBmrLoading(false);
      return undefined;
    }
    if (!user?.email) {
      setBmrLoading(false);
      return undefined;
    }

    let cancelled = false;
    setBmrLoading(true);
    const load = async () => {
      const target = await fetchUserCalorieTarget({ apiBaseUrl, email: user.email });
      if (!cancelled) {
        setCalorieTarget(target);
        setBmrLoading(false);
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
  }, [user?.email, apiBaseUrl, bmrUpdateKey, enabled]);

  return { calorieTarget, bmrLoading };
}
