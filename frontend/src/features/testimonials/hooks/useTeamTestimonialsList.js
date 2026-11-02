/**
 * useTeamTestimonialsList — server-paginated Direct/Full team rows with page cache.
 * Prevents duplicate in-flight requests; loads 10 at a time; infinite-scroll friendly.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { listForCoach } from '../services/testimonialApi.js';
import { TEAM_SCOPES, UPLOAD_FILTERS } from '../utils/testimonialFilters.js';

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;

function cacheKey({ scope, search, uploadFilter, page }) {
  return `${scope}|${search}|${uploadFilter}|${page}`;
}

/**
 * @param {{
 *   coachId: number|null|undefined,
 *   teamScope: string,
 *   searchQuery: string,
 *   uploadFilter: string,
 *   enabled: boolean,
 *   reloadToken?: number,
 * }} opts
 */
export function useTeamTestimonialsList({
  coachId,
  teamScope,
  searchQuery,
  uploadFilter,
  enabled,
  reloadToken = 0,
}) {
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 1,
    hasMore: false,
  });
  const [uploadCounts, setUploadCounts] = useState({
    fully_uploaded: 0,
    partial_upload: 0,
    not_uploaded: 0,
  });
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  const pageCacheRef = useRef(new Map());
  const inFlightRef = useRef(new Map());
  const generationRef = useRef(0);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(String(searchQuery || '').trim().toLowerCase());
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const scope = teamScope === TEAM_SCOPES.FULL ? 'full' : 'direct';
  const filter = uploadFilter || UPLOAD_FILTERS.ALL;

  const fetchPage = useCallback(async (page, { append }) => {
    if (!coachId || !enabled) return;
    if (teamScope === TEAM_SCOPES.MINE) return;

    const key = cacheKey({
      scope,
      search: debouncedSearch,
      uploadFilter: filter,
      page,
    });

    if (pageCacheRef.current.has(key)) {
      const cached = pageCacheRef.current.get(key);
      setPagination(cached.pagination);
      setUploadCounts(cached.uploadCounts);
      setRows((prev) => (append ? [...prev, ...cached.data] : cached.data));
      return;
    }

    if (inFlightRef.current.has(key)) {
      const result = await inFlightRef.current.get(key);
      setPagination(result.pagination);
      setUploadCounts(result.uploadCounts);
      setRows((prev) => (append ? [...prev, ...result.data] : result.data));
      return;
    }

    const generation = generationRef.current;
    const promise = listForCoach(coachId, {
      scope,
      page,
      limit: PAGE_SIZE,
      search: debouncedSearch,
      uploadFilter: filter,
    });
    inFlightRef.current.set(key, promise);

    try {
      const result = await promise;
      if (generation !== generationRef.current) return;
      pageCacheRef.current.set(key, result);
      setPagination(result.pagination);
      setUploadCounts(result.uploadCounts);
      setRows((prev) => (append ? [...prev, ...result.data] : result.data));
      setError(null);
    } catch (err) {
      if (generation !== generationRef.current) return;
      setError(err?.message || 'Failed to load team');
    } finally {
      inFlightRef.current.delete(key);
    }
  }, [coachId, enabled, teamScope, scope, debouncedSearch, filter]);

  // Reset + load page 1 when scope/search/filter/reload changes
  useEffect(() => {
    if (!enabled || !coachId || teamScope === TEAM_SCOPES.MINE) {
      setRows([]);
      return undefined;
    }
    generationRef.current += 1;
    pageCacheRef.current.clear();
    setRows([]);
    setLoading(true);
    let cancelled = false;
    (async () => {
      await fetchPage(1, { append: false });
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [coachId, enabled, teamScope, debouncedSearch, filter, reloadToken, fetchPage]);

  const loadMore = useCallback(async () => {
    if (!pagination.hasMore || loading || loadingMore) return;
    setLoadingMore(true);
    try {
      await fetchPage(pagination.page + 1, { append: true });
    } finally {
      setLoadingMore(false);
    }
  }, [pagination.hasMore, pagination.page, loading, loadingMore, fetchPage]);

  const invalidateCache = useCallback(() => {
    pageCacheRef.current.clear();
    generationRef.current += 1;
  }, []);

  return {
    rows,
    pagination,
    uploadCounts,
    loading,
    loadingMore,
    error,
    loadMore,
    invalidateCache,
    pageSize: PAGE_SIZE,
  };
}
