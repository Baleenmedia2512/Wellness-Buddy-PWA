/**
 * useUserCalorieTarget — fetch the user's BMR-based daily calorie target.
 *
 * Wraps fetchUserBmr() with a useEffect that re-runs on email/apiBaseUrl/
 * bmrUpdateKey change AND on tab visibility change (so editing BMR in the
 * profile screen and returning to nutrition picks up the new value).
 */
import { useState, useEffect } from 'react';
import { fetchUserBmr, DEFAULT_CALORIE_TARGET } from '../services/nutritionDashboard';

export function useUserCalorieTarget({ user, apiBaseUrl, bmrUpdateKey = 0 }) {
  const [calorieTarget, setCalorieTarget] = useState(DEFAULT_CALORIE_TARGET);

  useEffect(() => {
    if (!user?.email) return undefined;

    let cancelled = false;
    const load = async () => {
      const bmr = await fetchUserBmr({ apiBaseUrl, email: user.email });
      if (!cancelled) setCalorieTarget(bmr);
    };

    load();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user?.email, apiBaseUrl, bmrUpdateKey]);

  return calorieTarget;
}
