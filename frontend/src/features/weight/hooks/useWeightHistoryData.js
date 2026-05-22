/**
 * useWeightHistoryData.js — slice-internal data hook.
 *
 * Owns paginated weight-history state, userId resolution, profile fetch,
 * and infinite-scroll wiring. Mutators are exposed so sibling hooks
 * (`useWeightUndoActions`) can perform optimistic UI updates.
 */
import {
  useCallback, useEffect, useRef, useState,
} from 'react';
import { getUserId } from '../../../shared/services/userIdentity';
import { WEIGHT_PAGE_SIZE } from '../services/weightDashboardFormatter';

export function useWeightHistoryData({ user, apiBaseUrl }) {
  const [weightHistory, setWeightHistory] = useState([]);
  const [globalStats, setGlobalStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [, setError] = useState(null);
  const [hasMoreWeights, setHasMoreWeights] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [savedUserName, setSavedUserName] = useState(null);
  const [savedProfileImage, setSavedProfileImage] = useState(null);

  const userIdRef = useRef(null);
  const loadMoreSentinelRef = useRef(null);
  const loadingMoreRef = useRef(false);
  const hasMoreRef = useRef(false);
  const offsetRef = useRef(0);

  const fetchWeightHistory = useCallback(async ({ reset = false } = {}) => {
    try {
      if (reset) setLoading(true);
      else {
        if (loadingMoreRef.current || !hasMoreRef.current) return;
        loadingMoreRef.current = true; setLoadingMore(true);
      }
      setError(null);
      if (!userIdRef.current) userIdRef.current = user?.id || (await getUserId(user));
      const userId = userIdRef.current;
      if (!userId) { setLoading(false); return; }

      const currentOffset = reset ? 0 : offsetRef.current;
      const params = new URLSearchParams({
        userId, includeImage: 'false',
        limit: String(WEIGHT_PAGE_SIZE), offset: String(currentOffset), _t: Date.now(),
      });
      const r = await fetch(`${apiBaseUrl}/api/weight/history?${params}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
        cache: 'no-store',
      });
      const data = await r.json();
      if (!r.ok || !data.success) throw new Error(data.message || 'Failed to fetch weight history');

      const newRows = Array.isArray(data.data) ? data.data : [];
      if (reset) setWeightHistory(newRows);
      else setWeightHistory((prev) => {
        const seen = new Set(prev.map((e) => e?.ID));
        const merged = prev.slice();
        for (const row of newRows) if (!seen.has(row.ID)) merged.push(row);
        return merged;
      });
      setGlobalStats(data.stats || null);
      const nextOffset = currentOffset + newRows.length;
      const more = data.pagination ? !!data.pagination.hasMore : newRows.length === WEIGHT_PAGE_SIZE;
      offsetRef.current = nextOffset; hasMoreRef.current = more; setHasMoreWeights(more);
    } catch (err) {
      console.error('Fetch weight history error:', err);
      setError(err.message || 'Failed to load weight history');
    } finally {
      if (reset) setLoading(false);
      else { loadingMoreRef.current = false; setLoadingMore(false); }
    }
  }, [user, apiBaseUrl]);

  // Profile fetch
  useEffect(() => {
    const run = async () => {
      if (!user?.email) return;
      try {
        const r = await fetch(
          `${apiBaseUrl}/api/user/profile?email=${encodeURIComponent(user.email)}&_t=${Date.now()}`,
          { cache: 'no-store', headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' } },
        );
        if (!r.ok) return;
        const d = await r.json();
        if (d.success && d.data) {
          if (d.data.userName) setSavedUserName(d.data.userName);
          if (d.data.profileImage) setSavedProfileImage(d.data.profileImage);
        }
      } catch (err) { console.error('Error fetching profile for WeightDashboard:', err); }
    };
    run();
  }, [user?.email, apiBaseUrl]);

  // Reset & fetch on user change
  useEffect(() => {
    userIdRef.current = null;
    setWeightHistory([]); setHasMoreWeights(false);
    offsetRef.current = 0; hasMoreRef.current = false;
    fetchWeightHistory({ reset: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: listed deps would cause an infinite re-render
  }, [user?.id, user?.email]);

  // Infinite-scroll observer
  useEffect(() => {
    const el = loadMoreSentinelRef.current;
    if (!el) return undefined;
    const observer = new IntersectionObserver((entries) => {
      const e = entries[0];
      if (e?.isIntersecting && hasMoreRef.current && !loadingMoreRef.current) {
        fetchWeightHistory({ reset: false });
      }
    }, { rootMargin: '300px', threshold: 0 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMoreWeights, loading, fetchWeightHistory]);

  return {
    weightHistory, setWeightHistory, globalStats,
    loading, loadingMore, hasMoreWeights,
    savedUserName, savedProfileImage,
    userIdRef, loadMoreSentinelRef,
  };
}
