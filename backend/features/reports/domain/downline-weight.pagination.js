/**
 * Ideal Weight Report pagination — pure helpers (filter / sort / page slice).
 * Applied after weight rows are built so status classification stays intact.
 */

export const DOWNLINE_WEIGHT_DEFAULT_PAGE_SIZE = 20;
export const DOWNLINE_WEIGHT_MAX_PAGE_SIZE = 100;

export const TEAM_FILTERS = Object.freeze({
  MINE: 'mine',
  DIRECT: 'direct',
  FULL: 'full',
});

export const STATUS_FILTERS = Object.freeze({
  ALL: 'all',
  OFF_TRACK: 'off_track',
  ON_TRACK: 'on_track',
  NO_DATA: 'no_data',
});

export const SORT_KEYS = Object.freeze({
  STATUS: 'status',
  NAME: 'name',
  WEIGHT: 'weight',
});

const OFF_TRACK_STATUSES = new Set(['above_ideal', 'below_ideal']);
const NO_DATA_STATUSES = new Set(['no_weight', 'no_height']);
const STATUS_ORDER = Object.freeze({
  above_ideal: 0,
  below_ideal: 1,
  on_track: 2,
  no_weight: 3,
  no_height: 4,
});

const TEAM_FILTER_ALIASES = Object.freeze({
  mine: TEAM_FILTERS.MINE,
  self: TEAM_FILTERS.MINE,
  direct: TEAM_FILTERS.DIRECT,
  'direct-team': TEAM_FILTERS.DIRECT,
  full: TEAM_FILTERS.FULL,
  'full-team': TEAM_FILTERS.FULL,
});

const STATUS_FILTER_ALIASES = Object.freeze({
  all: STATUS_FILTERS.ALL,
  off_track: STATUS_FILTERS.OFF_TRACK,
  offtrack: STATUS_FILTERS.OFF_TRACK,
  'off-track': STATUS_FILTERS.OFF_TRACK,
  'off track': STATUS_FILTERS.OFF_TRACK,
  on_track: STATUS_FILTERS.ON_TRACK,
  ontrack: STATUS_FILTERS.ON_TRACK,
  'on-track': STATUS_FILTERS.ON_TRACK,
  'on track': STATUS_FILTERS.ON_TRACK,
  no_data: STATUS_FILTERS.NO_DATA,
  nodata: STATUS_FILTERS.NO_DATA,
  'no-data': STATUS_FILTERS.NO_DATA,
  'no data': STATUS_FILTERS.NO_DATA,
});

/**
 * @param {object} raw
 * @returns {{
 *   page: number,
 *   limit: number,
 *   search: string,
 *   teamFilter: string,
 *   statusFilter: string,
 *   sort: string,
 * }}
 */
export function normalizeDownlineWeightPagination(raw = {}) {
  let page = 1;
  if (raw.page != null && raw.page !== '') {
    const n = Number.parseInt(String(raw.page), 10);
    if (Number.isFinite(n) && n >= 1) page = n;
  }

  let limit = DOWNLINE_WEIGHT_DEFAULT_PAGE_SIZE;
  if (raw.limit != null && raw.limit !== '') {
    const n = Number.parseInt(String(raw.limit), 10);
    if (Number.isFinite(n) && n > 0) {
      limit = Math.min(n, DOWNLINE_WEIGHT_MAX_PAGE_SIZE);
    }
  }

  const search = String(raw.search || '').trim().toLowerCase();

  const teamRaw = String(raw.teamFilter ?? raw.teamScope ?? TEAM_FILTERS.DIRECT)
    .trim()
    .toLowerCase();
  const teamFilter = TEAM_FILTER_ALIASES[teamRaw] || TEAM_FILTERS.DIRECT;

  const statusRaw = String(raw.statusFilter ?? raw.status ?? STATUS_FILTERS.OFF_TRACK)
    .trim()
    .toLowerCase();
  const statusFilter = STATUS_FILTER_ALIASES[statusRaw] || STATUS_FILTERS.OFF_TRACK;

  const sortRaw = String(raw.sort || SORT_KEYS.STATUS).trim().toLowerCase();
  const sort = Object.values(SORT_KEYS).includes(sortRaw) ? sortRaw : SORT_KEYS.STATUS;

  return { page, limit, search, teamFilter, statusFilter, sort };
}

/**
 * @param {number} totalRecords
 * @param {number} page
 * @param {number} pageSize
 */
export function buildDownlineWeightPaginationMeta(totalRecords, page, pageSize) {
  const total = Math.max(0, Number(totalRecords) || 0);
  const size = Math.max(1, Number(pageSize) || DOWNLINE_WEIGHT_DEFAULT_PAGE_SIZE);
  const totalPages = total === 0 ? 0 : Math.ceil(total / size);
  let currentPage = Math.max(1, Number(page) || 1);
  if (totalPages > 0 && currentPage > totalPages) currentPage = totalPages;

  return {
    page: currentPage,
    limit: size,
    totalRecords: total,
    totalPages,
    currentPage,
    pageSize: size,
    hasNextPage: totalPages > 0 && currentPage < totalPages,
    hasPreviousPage: currentPage > 1 && total > 0,
  };
}

/** Bucket a row status into chip keys used by the Ideal Weight UI. */
export function getDownlineWeightStatusBucket(status) {
  if (OFF_TRACK_STATUSES.has(status)) return STATUS_FILTERS.OFF_TRACK;
  if (status === 'on_track') return STATUS_FILTERS.ON_TRACK;
  if (NO_DATA_STATUSES.has(status)) return STATUS_FILTERS.NO_DATA;
  return STATUS_FILTERS.NO_DATA;
}

/**
 * Resolve rows for Mine / Direct / Full (same rules as legacy client filters).
 * @param {object|null} self
 * @param {object[]} members
 * @param {string} teamFilter
 */
export function applyTeamFilter(self, members, teamFilter) {
  if (teamFilter === TEAM_FILTERS.MINE) {
    return self ? [self] : [];
  }
  const list = Array.isArray(members) ? members : [];
  if (teamFilter === TEAM_FILTERS.DIRECT) {
    return list.filter((row) => row?.isDirect === true);
  }
  return list;
}

/**
 * @param {object|null} self
 * @param {object[]} members
 */
export function countRowsByTeamFilter(self, members) {
  const list = Array.isArray(members) ? members : [];
  return {
    [TEAM_FILTERS.MINE]: self ? 1 : 0,
    [TEAM_FILTERS.DIRECT]: list.filter((row) => row?.isDirect === true).length,
    [TEAM_FILTERS.FULL]: list.length,
  };
}

/**
 * @param {object[]} rows
 */
export function countRowsByStatusFilter(rows) {
  const counts = { off_track: 0, on_track: 0, no_data: 0, all: 0 };
  const list = Array.isArray(rows) ? rows : [];
  for (const row of list) {
    const bucket = getDownlineWeightStatusBucket(row?.status);
    if (bucket === STATUS_FILTERS.OFF_TRACK) counts.off_track += 1;
    else if (bucket === STATUS_FILTERS.ON_TRACK) counts.on_track += 1;
    else counts.no_data += 1;
  }
  counts.all = list.length;
  return counts;
}

/**
 * @template T
 * @param {T[]} rows
 * @param {string} statusFilter
 * @returns {T[]}
 */
export function filterRowsByStatusFilter(rows, statusFilter) {
  const list = Array.isArray(rows) ? rows : [];
  if (!statusFilter || statusFilter === STATUS_FILTERS.ALL) return list;
  return list.filter((row) => getDownlineWeightStatusBucket(row?.status) === statusFilter);
}

/**
 * @template T
 * @param {T[]} rows
 * @param {string} searchNormalized
 * @returns {T[]}
 */
export function filterRowsBySearch(rows, searchNormalized) {
  const list = Array.isArray(rows) ? rows : [];
  if (!searchNormalized) return list;
  const q = searchNormalized;
  return list.filter((row) => String(row?.userName || '').toLowerCase().includes(q));
}

/**
 * @template T
 * @param {T[]} rows
 * @param {string} sort
 * @returns {T[]}
 */
export function sortDownlineWeightRows(rows, sort = SORT_KEYS.STATUS) {
  const list = Array.isArray(rows) ? [...rows] : [];
  if (sort === SORT_KEYS.NAME) {
    list.sort((a, b) => String(a?.userName || '').localeCompare(String(b?.userName || '')));
    return list;
  }
  if (sort === SORT_KEYS.WEIGHT) {
    list.sort((a, b) => {
      const aw = a?.currentWeight;
      const bw = b?.currentWeight;
      if (aw == null && bw == null) return 0;
      if (aw == null) return 1;
      if (bw == null) return -1;
      return Number(bw) - Number(aw);
    });
    return list;
  }
  list.sort((a, b) => (STATUS_ORDER[a?.status] ?? 99) - (STATUS_ORDER[b?.status] ?? 99));
  return list;
}

/**
 * Map a weight row to the slim list payload (fields required by Ideal Weight UI).
 * @param {object} row
 */
export function toDownlineWeightListSummary(row) {
  if (!row) return null;
  const currentWeight = row.currentWeight ?? null;
  const idealMin = row.idealMin ?? null;
  const idealMax = row.idealMax ?? null;
  let difference = null;
  if (currentWeight != null && idealMin != null && idealMax != null) {
    if (row.status === 'above_ideal') difference = Number((currentWeight - idealMax).toFixed(1));
    else if (row.status === 'below_ideal') difference = Number((idealMin - currentWeight).toFixed(1));
    else difference = 0;
  }

  return {
    userId: row.userId,
    userName: row.userName,
    currentWeight,
    idealMin,
    idealMax,
    status: row.status,
    difference,
    lastUpdated: row.lastUpdated ?? null,
    isDirect: row.isDirect === true,
    coachId: row.coachId ?? null,
    reportsToCoachId: row.reportsToCoachId ?? null,
    teamPerformance: row.teamPerformance ?? null,
  };
}

/**
 * Filter → sort → slice for one page of Ideal Weight rows.
 * Status counts are computed on the team-scoped set (before status/search),
 * matching the legacy client behaviour.
 *
 * @param {object|null} self
 * @param {object[]} members
 * @param {{
 *   page?: number,
 *   limit?: number,
 *   search?: string,
 *   teamFilter?: string,
 *   statusFilter?: string,
 *   sort?: string,
 * }} opts
 */
export function paginateDownlineWeightRecords(self, members, opts = {}) {
  const { page, limit, search, teamFilter, statusFilter, sort } =
    normalizeDownlineWeightPagination(opts);

  const teamScopeCounts = countRowsByTeamFilter(self, members);
  const scopeRows = applyTeamFilter(self, members, teamFilter);
  const statusCounts = countRowsByStatusFilter(scopeRows);

  const statusFiltered = filterRowsByStatusFilter(scopeRows, statusFilter);
  const searched = filterRowsBySearch(statusFiltered, search);
  const prepared = sortDownlineWeightRows(searched, sort);

  const pagination = buildDownlineWeightPaginationMeta(prepared.length, page, limit);
  const offset = (pagination.currentPage - 1) * pagination.pageSize;
  const pageRows = prepared
    .slice(offset, offset + pagination.pageSize)
    .map(toDownlineWeightListSummary)
    .filter(Boolean);

  return {
    records: pageRows,
    pagination,
    statusCounts,
    teamScopeCounts,
    teamFilter,
    statusFilter,
  };
}
