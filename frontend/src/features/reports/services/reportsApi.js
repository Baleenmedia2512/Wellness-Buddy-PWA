/**
 * reportsApi.js — Network calls for the Reports feature.
 * All fetch logic for this feature lives here; components never call fetch directly.
 */
import { CapacitorHttp } from '@capacitor/core';
import { getApiBaseUrl } from '../../../config/api.config.js';

export const DOWNLINE_WEIGHT_PAGE_SIZE = 20;

/** Client page cache TTL — mirrors backend short-lived snapshot cache. */
const PAGE_CACHE_TTL_MS = 20_000;

const pageCache = new Map();

function base() {
  return `${getApiBaseUrl()}/api/reports`;
}

function buildCacheKey({ coachId, page, limit, search, teamFilter, statusFilter, sort }) {
  return [
    coachId,
    page,
    limit,
    search || '',
    teamFilter || '',
    statusFilter || '',
    sort || '',
  ].join('|');
}

/**
 * Normalise API payload to { self, members, pagination, statusCounts, teamScopeCounts }.
 * Supports current paginated shape and legacy flat-array / unpaginated responses.
 */
export function normalizeDownlineWeightPayload(data, paginationFromRoot = null) {
  if (!data) {
    return {
      self: null,
      members: [],
      pagination: {
        page: 1,
        limit: DOWNLINE_WEIGHT_PAGE_SIZE,
        totalRecords: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      },
      statusCounts: { off_track: 0, on_track: 0, no_data: 0, all: 0 },
      teamScopeCounts: { mine: 0, direct: 0, full: 0 },
    };
  }

  if (Array.isArray(data)) {
    return {
      self: null,
      members: data,
      pagination: {
        page: 1,
        limit: data.length || DOWNLINE_WEIGHT_PAGE_SIZE,
        totalRecords: data.length,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
      statusCounts: { off_track: 0, on_track: 0, no_data: 0, all: data.length },
      teamScopeCounts: { mine: 0, direct: 0, full: data.length },
    };
  }

  const members = Array.isArray(data.members) ? data.members : [];
  const pagination = paginationFromRoot || {
    page: data.page ?? data.currentPage ?? 1,
    limit: data.limit ?? data.pageSize ?? DOWNLINE_WEIGHT_PAGE_SIZE,
    totalRecords: data.totalRecords ?? members.length,
    totalPages: data.totalPages ?? 1,
    hasNextPage: data.hasNextPage === true,
    hasPreviousPage: data.hasPreviousPage === true,
    currentPage: data.currentPage ?? data.page ?? 1,
    pageSize: data.pageSize ?? data.limit ?? DOWNLINE_WEIGHT_PAGE_SIZE,
  };

  return {
    self: data.self ?? null,
    members,
    pagination: {
      page: pagination.page ?? pagination.currentPage ?? 1,
      limit: pagination.limit ?? pagination.pageSize ?? DOWNLINE_WEIGHT_PAGE_SIZE,
      totalRecords: pagination.totalRecords ?? members.length,
      totalPages: pagination.totalPages ?? 0,
      hasNextPage: pagination.hasNextPage === true,
      hasPreviousPage: pagination.hasPreviousPage === true,
      currentPage: pagination.currentPage ?? pagination.page ?? 1,
      pageSize: pagination.pageSize ?? pagination.limit ?? DOWNLINE_WEIGHT_PAGE_SIZE,
    },
    statusCounts: data.statusCounts || { off_track: 0, on_track: 0, no_data: 0, all: 0 },
    teamScopeCounts: data.teamScopeCounts || { mine: 0, direct: 0, full: 0 },
  };
}

/**
 * Fetch one page of downline weight status.
 *
 * @param {number} coachId
 * @param {{
 *   page?: number,
 *   limit?: number,
 *   search?: string,
 *   teamFilter?: string,
 *   statusFilter?: string,
 *   sort?: string,
 *   bustCache?: boolean,
 * }} [opts]
 */
export async function fetchDownlineWeightStatus(coachId, opts = {}) {
  const page = opts.page ?? 1;
  const limit = opts.limit ?? DOWNLINE_WEIGHT_PAGE_SIZE;
  const search = String(opts.search || '').trim();
  const teamFilter = opts.teamFilter || 'direct';
  const statusFilter = opts.statusFilter || 'off_track';
  const sort = opts.sort || 'status';
  const bustCache = opts.bustCache === true;

  const cacheKey = buildCacheKey({
    coachId,
    page,
    limit,
    search,
    teamFilter,
    statusFilter,
    sort,
  });

  if (!bustCache) {
    const cached = pageCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.payload;
    }
  }

  const params = new URLSearchParams({
    coachId: String(coachId),
    page: String(page),
    limit: String(limit),
    teamFilter,
    statusFilter,
    sort,
  });
  if (search) params.set('search', search);

  const res = await CapacitorHttp.get({
    url: `${base()}/downline-weight-status?${params.toString()}`,
  });
  const result = res.data;
  if (!result?.success) {
    throw new Error(result?.message || 'Failed to fetch downline weight status');
  }

  const payload = normalizeDownlineWeightPayload(result.data, result.pagination);
  pageCache.set(cacheKey, {
    payload,
    expiresAt: Date.now() + PAGE_CACHE_TTL_MS,
  });
  return payload;
}

/** Drop cached Ideal Weight pages (e.g. on manual refresh). */
export function clearDownlineWeightPageCache() {
  pageCache.clear();
}
