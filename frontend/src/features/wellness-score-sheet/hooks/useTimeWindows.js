import { useCallback, useEffect, useState } from 'react';
import { getTimeWindows } from '../../misc/services/misc.api';

/** Module cache — survive Wellness Score remounts without re-flashing generic hints. */
let cachedTimeWindows = null;
let inFlight = null;

/**
 * Prefetch / reuse activity time windows (safe to call from home tile mount).
 * @returns {Promise<object|null>}
 */
export async function prefetchTimeWindows() {
  if (cachedTimeWindows) return cachedTimeWindows;
  if (inFlight) return inFlight;

  inFlight = getTimeWindows()
    .then((data) => {
      if (data?.success && data?.windows) {
        cachedTimeWindows = data.windows;
        return cachedTimeWindows;
      }
      return null;
    })
    .catch(() => null)
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

/** Drop the in-memory cache so the next fetch gets fresh windows. */
export function invalidateTimeWindowsCache() {
  cachedTimeWindows = null;
  inFlight = null;
}

/**
 * Force-refresh activity time windows (e.g. after admin save).
 * @returns {Promise<object|null>}
 */
export async function refreshTimeWindows() {
  invalidateTimeWindowsCache();
  return prefetchTimeWindows();
}

/**
 * Loads activity time windows from /api/misc/time-windows for wellness score hints.
 * Cached in memory so reopen paints timed hints immediately.
 * @returns {{ timeWindows: object|null, refresh: () => Promise<object|null> }}
 */
export function useTimeWindows() {
  const [timeWindows, setTimeWindows] = useState(() => cachedTimeWindows);

  useEffect(() => {
    let cancelled = false;

    if (cachedTimeWindows) {
      setTimeWindows(cachedTimeWindows);
      return undefined;
    }

    prefetchTimeWindows().then((windows) => {
      if (!cancelled && windows) setTimeWindows(windows);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = useCallback(async () => {
    const windows = await refreshTimeWindows();
    if (windows) setTimeWindows(windows);
    return windows;
  }, []);

  return { timeWindows, refresh };
}

/** @internal test helper */
export function __resetTimeWindowsCacheForTests() {
  cachedTimeWindows = null;
  inFlight = null;
}
