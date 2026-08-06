/**
 * frontend/src/features/diary/hooks/useDiary.js
 *
 * Paginated diary feed hook: first page on mount, subsequent pages via
 * loadMore (infinite scroll). Caches pages by offset to avoid duplicate
 * network calls. In-flight guard prevents overlapping scroll fetches.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchDiary, DIARY_PAGE_SIZE } from '../api/diaryClient';
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
 * @param {number} [params.pageSize]
 * @returns {{
 *   loading: boolean,
 *   loadingMore: boolean,
 *   error: { status: number|null, message: string } | null,
 *   data: object | null,
 *   hasMore: boolean,
 *   loadMore: () => void,
 *   loadMoreSentinelRef: React.MutableRefObject<HTMLElement|null>,
 *   refresh: () => void,
 * }}
 */
export function useDiary({
  ownerUserId,
  viewerUserId,
  date,
  timezoneSource = null,
  refreshKey: externalRefreshKey = 0,
  pageSize = DIARY_PAGE_SIZE,
}) {
  const timezoneIana = typeof timezoneSource === 'string'
    ? timezoneSource
    : resolveDiaryTimezone(timezoneSource);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [internalRefreshKey, setInternalRefreshKey] = useState(0);
  const refreshKey = internalRefreshKey + externalRefreshKey;

  const offsetRef = useRef(0);
  const hasMoreRef = useRef(false);
  const loadingMoreRef = useRef(false);
  const inFlightRef = useRef(false);
  /** @type {React.MutableRefObject<Map<number, object>>} */
  const pageCacheRef = useRef(new Map());
  const cacheKeyRef = useRef('');
  const loadMoreSentinelRef = useRef(null);
  const abortRef = useRef(null);

  const refresh = useCallback(() => setInternalRefreshKey((n) => n + 1), []);

  const mergeEntries = useCallback((prevEntries, nextEntries) => {
    const seen = new Set(
      (prevEntries || []).map((e) => `${e.kind}:${e.payload?.id ?? e.capturedAt}`),
    );
    const merged = (prevEntries || []).slice();
    for (const entry of nextEntries || []) {
      const key = `${entry.kind}:${entry.payload?.id ?? entry.capturedAt}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(entry);
    }
    return merged;
  }, []);

  const fetchPage = useCallback(async ({ reset = false, signal } = {}) => {
    if (!ownerUserId || !viewerUserId || !date) return;

    const ymd = toYmd(date, timezoneIana);
    if (!ymd) {
      setError({ status: null, message: 'Invalid date' });
      setLoading(false);
      return;
    }

    const cacheScope = `${ownerUserId}|${viewerUserId}|${ymd}|${pageSize}`;
    if (cacheKeyRef.current !== cacheScope) {
      pageCacheRef.current = new Map();
      cacheKeyRef.current = cacheScope;
    }

    if (reset) {
      offsetRef.current = 0;
      hasMoreRef.current = false;
      setHasMore(false);
    } else {
      if (loadingMoreRef.current || inFlightRef.current || !hasMoreRef.current) return;
    }

    const currentOffset = reset ? 0 : offsetRef.current;

    // Serve cached pages without a network round-trip (scroll back / remount).
    if (!reset && pageCacheRef.current.has(currentOffset)) {
      const cached = pageCacheRef.current.get(currentOffset);
      const pageEntries = cached?.entries || [];
      const pagination = cached?.pagination || {};
      setData((prev) => {
        if (!prev) return cached;
        return {
          ...prev,
          ...cached,
          entries: mergeEntries(prev.entries, pageEntries),
          pagination,
        };
      });
      const nextOffset = pagination.nextOffset != null
        ? pagination.nextOffset
        : currentOffset + pageEntries.length;
      offsetRef.current = nextOffset;
      hasMoreRef.current = !!pagination.hasMore;
      setHasMore(!!pagination.hasMore);
      return;
    }

    if (reset) {
      setLoading(true);
      setError(null);
    } else {
      loadingMoreRef.current = true;
      inFlightRef.current = true;
      setLoadingMore(true);
    }
    inFlightRef.current = true;

    try {
      const payload = await fetchDiary({
        ownerUserId,
        viewerUserId,
        date: ymd,
        limit: pageSize,
        offset: currentOffset,
        signal,
      });
      if (signal?.aborted) return;

      pageCacheRef.current.set(currentOffset, payload);

      const pageEntries = Array.isArray(payload.entries) ? payload.entries : [];
      const pagination = payload.pagination || {
        limit: pageSize,
        offset: currentOffset,
        total: pageEntries.length,
        hasMore: pageEntries.length >= pageSize,
        nextOffset: pageEntries.length >= pageSize
          ? currentOffset + pageEntries.length
          : null,
      };

      setData((prev) => {
        if (reset || !prev) return payload;
        return {
          ...payload,
          entries: mergeEntries(prev.entries, pageEntries),
        };
      });

      const nextOffset = pagination.nextOffset != null
        ? pagination.nextOffset
        : currentOffset + pageEntries.length;
      offsetRef.current = nextOffset;
      hasMoreRef.current = !!pagination.hasMore;
      setHasMore(!!pagination.hasMore);
      setError(null);
    } catch (err) {
      if (isAbortError(err) || signal?.aborted) return;
      debugLog('[diary] useDiary error', err?.message);
      setError({
        status: err?.response?.status ?? null,
        message: err?.response?.data?.message
              || err?.message
              || 'Failed to load diary',
      });
      if (reset) setData(null);
    } finally {
      inFlightRef.current = false;
      loadingMoreRef.current = false;
      setLoading(false);
      setLoadingMore(false);
    }
  }, [ownerUserId, viewerUserId, date, timezoneIana, pageSize, mergeEntries]);

  const loadMore = useCallback(() => {
    if (!hasMoreRef.current || loadingMoreRef.current || inFlightRef.current) return;
    fetchPage({ reset: false, signal: abortRef.current?.signal });
  }, [fetchPage]);

  // Initial + refresh fetch
  useEffect(() => {
    if (!ownerUserId || !viewerUserId || !date) {
      setData(null);
      setError(null);
      setLoading(false);
      setHasMore(false);
      return undefined;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    // Invalidate cache on explicit refresh so polling picks up new AI rows.
    if (externalRefreshKey > 0 || internalRefreshKey > 0) {
      pageCacheRef.current = new Map();
    }
    fetchPage({ reset: true, signal: controller.signal });

    return () => {
      controller.abort();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- refreshKey drives intentional reloads
  }, [ownerUserId, viewerUserId, date, timezoneIana, refreshKey, pageSize, fetchPage]);

  // Infinite-scroll observer
  useEffect(() => {
    const el = loadMoreSentinelRef.current;
    if (!el) return undefined;
    const observer = new IntersectionObserver((entries) => {
      const e = entries[0];
      if (e?.isIntersecting && hasMoreRef.current && !loadingMoreRef.current && !inFlightRef.current) {
        loadMore();
      }
    }, { rootMargin: '280px', threshold: 0 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore, data?.entries?.length, hasMore]);

  return {
    loading,
    loadingMore,
    error,
    data,
    hasMore,
    loadMore,
    loadMoreSentinelRef,
    refresh,
  };
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
