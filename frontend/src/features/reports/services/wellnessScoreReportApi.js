/**
 * API client for Wellness Score Report — cache-first + background refresh.
 */
import { CapacitorHttp } from '@capacitor/core';
import { getApiBaseUrl } from '../../../config/api.config.js';

export const WELLNESS_SCORE_REPORT_PAGE_SIZE = 10;

const PAGE_CACHE_TTL_MS = 60_000;
const STALE_TTL_MS = 5 * 60_000;
const pageCache = new Map();
/** @type {Map<string, Promise<object>>} */
const inflight = new Map();

const SESSION_CACHE_PREFIX = 'wsReport:v1:';

function base() {
  return `${getApiBaseUrl()}/api/reports`;
}

export function buildWellnessScoreReportCacheKey({
  coachId,
  page,
  limit,
  search,
  teamFilter,
  sort,
  date,
  exportAll,
}) {
  return [
    coachId,
    page,
    limit,
    search || '',
    teamFilter || '',
    sort || '',
    date || '',
    exportAll ? '1' : '0',
  ].join('|');
}

function readSessionCache(cacheKey) {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    const raw = sessionStorage.getItem(SESSION_CACHE_PREFIX + cacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.payload || !parsed?.savedAt) return null;
    if (Date.now() - parsed.savedAt > STALE_TTL_MS) return null;
    return parsed.payload;
  } catch {
    return null;
  }
}

function writeSessionCache(cacheKey, payload) {
  try {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.setItem(
      SESSION_CACHE_PREFIX + cacheKey,
      JSON.stringify({ payload, savedAt: Date.now() }),
    );
  } catch {
    /* quota / private mode */
  }
}

/**
 * Sync peek — memory first, then sessionStorage. Does not hit the network.
 */
export function peekWellnessScoreReportCache(coachId, opts = {}) {
  const cacheKey = buildWellnessScoreReportCacheKey({
    coachId,
    page: opts.page ?? 1,
    limit: opts.limit ?? WELLNESS_SCORE_REPORT_PAGE_SIZE,
    search: String(opts.search || '').trim(),
    teamFilter: opts.teamFilter || 'direct',
    sort: opts.sort || 'score',
    date: opts.date ? String(opts.date) : null,
    exportAll: false,
  });

  const mem = pageCache.get(cacheKey);
  if (mem?.payload) {
    return {
      payload: mem.payload,
      fresh: mem.expiresAt > Date.now(),
      cacheKey,
    };
  }

  const sessionPayload = readSessionCache(cacheKey);
  if (sessionPayload) {
    return { payload: sessionPayload, fresh: false, cacheKey };
  }

  return { payload: null, fresh: false, cacheKey };
}

/**
 * @param {object|null} data
 * @param {object|null} paginationFromRoot
 */
export function normalizeWellnessScoreReportPayload(data, paginationFromRoot = null) {
  if (!data) {
    return {
      members: [],
      pagination: {
        page: 1,
        limit: WELLNESS_SCORE_REPORT_PAGE_SIZE,
        totalRecords: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      },
      teamScopeCounts: { mine: 0, direct: 0, full: 0 },
      scoreDate: null,
    };
  }

  const members = Array.isArray(data.members)
    ? data.members
    : Array.isArray(data)
      ? data
      : [];

  const pagination = paginationFromRoot || {
    page: data.page ?? data.currentPage ?? 1,
    limit: data.limit ?? data.pageSize ?? WELLNESS_SCORE_REPORT_PAGE_SIZE,
    totalRecords: data.totalRecords ?? members.length,
    totalPages: data.totalPages ?? 1,
    hasNextPage: data.hasNextPage === true,
    hasPreviousPage: data.hasPreviousPage === true,
    currentPage: data.currentPage ?? data.page ?? 1,
    pageSize: data.pageSize ?? data.limit ?? WELLNESS_SCORE_REPORT_PAGE_SIZE,
  };

  return {
    members,
    pagination: {
      page: pagination.page ?? pagination.currentPage ?? 1,
      limit: pagination.limit ?? pagination.pageSize ?? WELLNESS_SCORE_REPORT_PAGE_SIZE,
      totalRecords: pagination.totalRecords ?? members.length,
      totalPages: pagination.totalPages ?? 0,
      hasNextPage: pagination.hasNextPage === true,
      hasPreviousPage: pagination.hasPreviousPage === true,
      currentPage: pagination.currentPage ?? pagination.page ?? 1,
      pageSize: pagination.pageSize ?? pagination.limit ?? WELLNESS_SCORE_REPORT_PAGE_SIZE,
    },
    teamScopeCounts: data.teamScopeCounts || { mine: 0, direct: 0, full: 0 },
    scoreDate: data.scoreDate ?? null,
  };
}

function applyPayloadToCache(cacheKey, payload, exportAll) {
  if (exportAll) return;
  pageCache.set(cacheKey, {
    payload,
    expiresAt: Date.now() + PAGE_CACHE_TTL_MS,
  });
  writeSessionCache(cacheKey, payload);
}

async function requestWellnessScoreReport(coachId, opts, cacheKey) {
  const page = opts.page ?? 1;
  const limit = opts.limit ?? WELLNESS_SCORE_REPORT_PAGE_SIZE;
  const search = String(opts.search || '').trim();
  const teamFilter = opts.teamFilter || 'direct';
  const sort = opts.sort || 'score';
  const date = opts.date ? String(opts.date) : null;
  const exportAll = opts.exportAll === true;

  const params = new URLSearchParams({
    coachId: String(coachId),
    page: String(page),
    limit: String(limit),
    teamFilter,
    sort,
  });
  if (search) params.set('search', search);
  if (date) params.set('date', date);
  if (exportAll) params.set('exportAll', 'true');
  // Bust HTTP disk/304 cache — app owns freshness via memory/session cache.
  params.set('_', String(Date.now()));

  const res = await CapacitorHttp.get({
    url: `${base()}/wellness-score-report?${params.toString()}`,
    headers: {
      'Cache-Control': 'no-cache, no-store',
      Pragma: 'no-cache',
    },
  });
  const result = res.data;
  if (!result?.success) {
    throw new Error(result?.message || 'Failed to fetch wellness score report');
  }

  const payload = normalizeWellnessScoreReportPayload(result.data, result.pagination);
  applyPayloadToCache(cacheKey, payload, exportAll);
  return payload;
}

/**
 * @param {number} coachId
 * @param {{
 *   page?: number,
 *   limit?: number,
 *   search?: string,
 *   teamFilter?: string,
 *   sort?: string,
 *   date?: string,
 *   exportAll?: boolean,
 *   bustCache?: boolean,
 *   allowStale?: boolean,
 * }} [opts]
 */
export async function fetchWellnessScoreReport(coachId, opts = {}) {
  const page = opts.page ?? 1;
  const limit = opts.limit ?? WELLNESS_SCORE_REPORT_PAGE_SIZE;
  const search = String(opts.search || '').trim();
  const teamFilter = opts.teamFilter || 'direct';
  const sort = opts.sort || 'score';
  const date = opts.date ? String(opts.date) : null;
  const exportAll = opts.exportAll === true;
  const bustCache = opts.bustCache === true;
  const allowStale = opts.allowStale === true;

  const cacheKey = buildWellnessScoreReportCacheKey({
    coachId,
    page,
    limit,
    search,
    teamFilter,
    sort,
    date,
    exportAll,
  });

  if (!bustCache && !exportAll) {
    const mem = pageCache.get(cacheKey);
    if (mem?.payload && mem.expiresAt > Date.now()) {
      return mem.payload;
    }
    if (allowStale && mem?.payload) {
      return mem.payload;
    }
    const pending = inflight.get(cacheKey);
    if (pending) return pending;
  }

  let resolveFn;
  let rejectFn;
  const gate = new Promise((resolve, reject) => {
    resolveFn = resolve;
    rejectFn = reject;
  });
  if (!exportAll) {
    inflight.set(cacheKey, gate);
  }

  try {
    const payload = await requestWellnessScoreReport(coachId, opts, cacheKey);
    resolveFn(payload);
    return payload;
  } catch (err) {
    rejectFn(err);
    throw err;
  } finally {
    if (inflight.get(cacheKey) === gate) {
      inflight.delete(cacheKey);
    }
  }
}

export function clearWellnessScoreReportPageCache() {
  pageCache.clear();
  inflight.clear();
}
