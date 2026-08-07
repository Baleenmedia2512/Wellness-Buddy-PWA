/**
 * API client for Wellness Score Report — paginated fetch + export-all by date.
 * In-flight + memory cache prevent duplicate network calls (StrictMode / prefetch).
 */
import { CapacitorHttp } from '@capacitor/core';
import { getApiBaseUrl } from '../../../config/api.config.js';

export const WELLNESS_SCORE_REPORT_PAGE_SIZE = 10;

const PAGE_CACHE_TTL_MS = 20_000;
const pageCache = new Map();
/** @type {Map<string, Promise<object>>} */
const inflight = new Map();

function base() {
  return `${getApiBaseUrl()}/api/reports`;
}

function buildCacheKey({ coachId, page, limit, search, teamFilter, sort, date, exportAll }) {
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

  const res = await CapacitorHttp.get({
    url: `${base()}/wellness-score-report?${params.toString()}`,
    headers: {
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    },
  });
  const result = res.data;
  if (!result?.success) {
    throw new Error(result?.message || 'Failed to fetch wellness score report');
  }

  const payload = normalizeWellnessScoreReportPayload(result.data, result.pagination);
  if (!exportAll) {
    pageCache.set(cacheKey, {
      payload,
      expiresAt: Date.now() + PAGE_CACHE_TTL_MS,
    });
  }
  return payload;
}

/**
 * Fetch one page (or full export) of the Wellness Score Report.
 *
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

  const cacheKey = buildCacheKey({
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
    const cached = pageCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.payload;
    }
    const pending = inflight.get(cacheKey);
    if (pending) return pending;
  }

  // Register inflight BEFORE I/O so concurrent callers share one request.
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
