/**
 * frontend/src/features/diary/hooks/useDiary.js
 *
 * Data hook for the Diary feed. Wraps `fetchDiary` with loading /
 * error / abort handling. Re-fetches whenever the owner, viewer, or
 * date changes.
 *
 * Progressive media: records render first (images stripped to placeholders),
 * then media is hydrated on the next frame so large base64 payloads do not
 * block first paint. API response shape is unchanged.
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
 * Strip inline image bytes from diary entries so the list can paint immediately.
 * Keeps a `hasImage` hint so Thumb can show a placeholder.
 * @param {object} payload
 * @returns {{ records: object, media: object }}
 */
function splitRecordsAndMedia(payload) {
  if (!payload || !Array.isArray(payload.entries)) {
    return { records: payload, media: null };
  }

  const mediaByKey = {};
  const entries = payload.entries.map((entry, index) => {
    const p = entry?.payload;
    if (!p) return entry;
    const imageBase64 = p.imageBase64;
    const hasImage = Boolean(
      (imageBase64 && String(imageBase64).trim() !== '')
      || (p.imagePath && String(p.imagePath).trim() !== ''),
    );
    if (imageBase64 && String(imageBase64).trim() !== '') {
      mediaByKey[`${entry.kind}:${p.id ?? index}`] = imageBase64;
    }
    return {
      ...entry,
      payload: {
        ...p,
        imageBase64: null,
        hasImage,
      },
    };
  });

  return {
    records: { ...payload, entries },
    media: Object.keys(mediaByKey).length ? mediaByKey : null,
  };
}

/**
 * Re-attach deferred imageBase64 onto record entries.
 * @param {object} records
 * @param {Record<string, string>} mediaByKey
 */
function hydrateMedia(records, mediaByKey) {
  if (!records || !mediaByKey) return records;
  return {
    ...records,
    entries: (records.entries || []).map((entry, index) => {
      const p = entry?.payload;
      if (!p) return entry;
      const key = `${entry.kind}:${p.id ?? index}`;
      const imageBase64 = mediaByKey[key];
      if (!imageBase64) return entry;
      return {
        ...entry,
        payload: { ...p, imageBase64 },
      };
    }),
  };
}

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

    let hydrateRaf = 0;

    fetchDiary({
      ownerUserId,
      viewerUserId,
      date: ymd,
      signal: controller.signal,
    })
      .then((payload) => {
        if (controller.signal.aborted) return;
        const { records, media } = splitRecordsAndMedia(payload);
        // Paint records immediately (placeholders for media).
        setData(records);
        setLoading(false);
        if (!media) return;
        // Hydrate images after first paint so media never blocks interactivity.
        hydrateRaf = requestAnimationFrame(() => {
          if (controller.signal.aborted) return;
          setData((prev) => hydrateMedia(prev || records, media));
        });
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

    return () => {
      controller.abort();
      if (hydrateRaf) cancelAnimationFrame(hydrateRaf);
    };
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
