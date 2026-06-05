/**
 * useUserLatestWeight — fetch the user's latest weight (kg) from their profile.
 *
 * Re-fetches on tab visibility change so profile edits are reflected without
 * a page reload. Returns null when weight is unavailable (new user, DB = 0,
 * network error).
 */
import { useState, useEffect } from 'react';
import { fetchUserLatestWeight } from '../services/nutritionDashboard/userProfileApi';

export function useUserLatestWeight({ user, apiBaseUrl }) {
  const [latestWeight, setLatestWeight] = useState(null);

  useEffect(() => {
    if (!user?.email) return undefined;

    let cancelled = false;
    const load = async () => {
      const w = await fetchUserLatestWeight({ apiBaseUrl, email: user.email });
      if (!cancelled) setLatestWeight(w);
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
  }, [user?.email, apiBaseUrl]);

  return latestWeight;
}
