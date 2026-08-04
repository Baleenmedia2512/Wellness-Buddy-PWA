/**
 * Keeps latest-weight cache warm and returns cached value immediately.
 */
import { useEffect, useState } from 'react';
import {
  fetchLatestWeightEntry,
  getCachedLatestWeight,
} from '../services/weight.api';

export function useLastWeightReference({ userId, enabled = true }) {
  const [lastWeight, setLastWeight] = useState(
    () => (enabled && userId ? getCachedLatestWeight(userId) : null),
  );

  useEffect(() => {
    if (!enabled || !userId) {
      setLastWeight(null);
      return undefined;
    }

    const cached = getCachedLatestWeight(userId);
    if (cached) setLastWeight(cached);

    let cancelled = false;
    fetchLatestWeightEntry(userId)
      .then((entry) => {
        if (!cancelled) setLastWeight(entry ?? cached ?? null);
      })
      .catch(() => {
        if (!cancelled && cached) setLastWeight(cached);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, enabled]);

  return lastWeight;
}
