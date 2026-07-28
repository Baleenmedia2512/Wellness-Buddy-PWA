/**
 * frontend/src/features/diary/hooks/useDiary.js
 *
 * Data hook for the Diary feed. Wraps `fetchDiary` with loading /
 * error / abort handling. Re-fetches whenever the owner, viewer, or
 * date changes.
 *
 * Returns the same shape regardless of state — components destructure
 * what they need and let booleans drive their render branches.
 */

import { useCallback, useEffect, useState } from 'react';
import { fetchDiary } from '../api/diaryClient';
import { isAbortError } from '../../../shared/utils/fetchWithAbort';
import { debugLog } from '../../../shared/utils/logger';
import {
  dateToBusinessYmd,
  DEFAULT_BUSINESS_TIMEZONE,
} from '../../../shared/utils/datetimeUtils';
import { resolveDiaryTimezone } from '../utils/diaryTimezone';

/**
 * @param {Object} params
 * @param {string|null} params.ownerUserId
 * @param {string|null} params.viewerUserId
 * @param {Date|string|null} params.date  Date instance or YYYY-MM-DD string
 * @param {string|object|null} [params.timezoneSource] Owner user or IANA timezone for calendar dates
 * @param {number} [params.refreshKey]  bump to trigger a background re-fetch without unmounting
 * @returns {{
 *   loading: boolean,
 *   error: { status: number|null, message: string } | null,
 *   data: import('../api/diaryClient').DiaryListResponse | null,
 *   refresh: () => void,
 * }}
 */
export function useDiary({
  ownerUserId,
  viewerUserId,
  date,
  timezoneSource = null,
  refreshKey: externalRefreshKey = 0,
}) {
  const timezoneIana = typeof timezoneSource === 'string'
    ? timezoneSource
    : resolveDiaryTimezone(timezoneSource);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // Bump to trigger a manual refresh without changing the deps.
  const [internalRefreshKey, setInternalRefreshKey] = useState(0);
  // Combined key: either internal (from refresh()) or external (from parent prop) bump triggers re-fetch.
  const refreshKey = internalRefreshKey + externalRefreshKey;

  const refresh = useCallback(() => setInternalRefreshKey((n) => n + 1), []);

  useEffect(() => {
    // Guard inputs early — the parent might not have resolved the
    // user yet on first render.
    if (!ownerUserId || !viewerUserId || !date) {
      setData(null);
      setError(null);
      setLoading(false);
      return undefined;
    }

    const ymd = toYmd(date, timezoneIana);
    if (!ymd) {
      setError({ status: null, message: 'Invalid date' });
      setLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);
    // Note: do NOT setData(null) here — keep stale data visible during
    // background refresh so the feed never flashes a skeleton mid-session.

    fetchDiary({
      ownerUserId,
      viewerUserId,
      date: ymd,
      signal: controller.signal,
    })
      .then((payload) => {
        setData(payload);
        setLoading(false);
      })
      .catch((err) => {
        if (isAbortError(err) || controller.signal.aborted) return;
        debugLog('[diary] useDiary error', err?.message);
        setError({
          status: err?.response?.status ?? null,
          message: err?.response?.data?.message
                || err?.message
                || 'Failed to load diary',
        });
        setLoading(false);
      });

    return () => controller.abort();
  }, [ownerUserId, viewerUserId, date, timezoneIana, refreshKey]);

  return { loading, error, data, refresh };
}

/**
 * Normalise a Date | YYYY-MM-DD string to business-calendar YYYY-MM-DD.
 * @internal — exported for tests only.
 */
export function toYmd(date, timezoneIana = DEFAULT_BUSINESS_TIMEZONE) {
  if (typeof date === 'string') {
    return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
  }
  return dateToBusinessYmd(date, timezoneIana);
}
