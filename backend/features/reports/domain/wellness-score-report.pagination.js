/**
 * Wellness Score Report — pure filter / sort / page helpers.
 * Default order: percentage DESC, computed_at DESC (matches SQL ORDER BY).
 * Default page size: 10.
 */

export const WELLNESS_SCORE_REPORT_DEFAULT_PAGE_SIZE = 10;
export const WELLNESS_SCORE_REPORT_MAX_PAGE_SIZE = 100;

export const TEAM_FILTERS = Object.freeze({
  MINE: 'mine',
  DIRECT: 'direct',
  FULL: 'full',
});

export const SORT_KEYS = Object.freeze({
  SCORE: 'score',
  NAME: 'name',
  WEIGHT: 'weight',
  VS_PREVIOUS: 'vsPrevious',
  SPONSOR: 'sponsor',
});

export const SORT_DIRS = Object.freeze({
  ASC: 'asc',
  DESC: 'desc',
});

/** First-click / default direction per column. */
export const DEFAULT_SORT_DIR_BY_KEY = Object.freeze({
  [SORT_KEYS.SCORE]: SORT_DIRS.DESC,
  [SORT_KEYS.NAME]: SORT_DIRS.ASC,
  [SORT_KEYS.WEIGHT]: SORT_DIRS.ASC,
  [SORT_KEYS.VS_PREVIOUS]: SORT_DIRS.DESC,
  [SORT_KEYS.SPONSOR]: SORT_DIRS.ASC,
});

const TEAM_FILTER_ALIASES = Object.freeze({
  mine: TEAM_FILTERS.MINE,
  self: TEAM_FILTERS.MINE,
  direct: TEAM_FILTERS.DIRECT,
  'direct-team': TEAM_FILTERS.DIRECT,
  full: TEAM_FILTERS.FULL,
  'full-team': TEAM_FILTERS.FULL,
});

const SORT_KEY_ALIASES = Object.freeze({
  score: SORT_KEYS.SCORE,
  percentage: SORT_KEYS.SCORE,
  name: SORT_KEYS.NAME,
  weight: SORT_KEYS.WEIGHT,
  vsprevious: SORT_KEYS.VS_PREVIOUS,
  vs_previous: SORT_KEYS.VS_PREVIOUS,
  difference: SORT_KEYS.VS_PREVIOUS,
  delta: SORT_KEYS.VS_PREVIOUS,
  sponsor: SORT_KEYS.SPONSOR,
  sponsorname: SORT_KEYS.SPONSOR,
  sponsor_name: SORT_KEYS.SPONSOR,
});

/**
 * @param {string|null|undefined} raw
 * @returns {string}
 */
export function normalizeWellnessScoreReportSortKey(raw) {
  const key = String(raw || SORT_KEYS.SCORE).trim().toLowerCase().replace(/[\s-]+/g, '_');
  const compact = key.replace(/_/g, '');
  return SORT_KEY_ALIASES[key] || SORT_KEY_ALIASES[compact] || SORT_KEYS.SCORE;
}

/**
 * @param {string|null|undefined} raw
 * @param {string} [sortKey]
 * @returns {'asc'|'desc'}
 */
export function normalizeWellnessScoreReportSortDir(raw, sortKey = SORT_KEYS.SCORE) {
  const dir = String(raw || '').trim().toLowerCase();
  if (dir === SORT_DIRS.ASC || dir === SORT_DIRS.DESC) return dir;
  return DEFAULT_SORT_DIR_BY_KEY[sortKey] || SORT_DIRS.DESC;
}

/**
 * @param {object} raw
 */
export function normalizeWellnessScoreReportPagination(raw = {}) {
  let page = 1;
  if (raw.page != null && raw.page !== '') {
    const n = Number.parseInt(String(raw.page), 10);
    if (Number.isFinite(n) && n >= 1) page = n;
  }

  let limit = WELLNESS_SCORE_REPORT_DEFAULT_PAGE_SIZE;
  if (raw.limit != null && raw.limit !== '') {
    const n = Number.parseInt(String(raw.limit), 10);
    if (Number.isFinite(n) && n > 0) {
      limit = Math.min(n, WELLNESS_SCORE_REPORT_MAX_PAGE_SIZE);
    }
  }

  const search = String(raw.search || '').trim().toLowerCase();

  const teamRaw = String(raw.teamFilter ?? raw.teamScope ?? TEAM_FILTERS.DIRECT)
    .trim()
    .toLowerCase();
  const teamFilter = TEAM_FILTER_ALIASES[teamRaw] || TEAM_FILTERS.DIRECT;

  // Default: highest wellness % first (product requirement).
  const sort = normalizeWellnessScoreReportSortKey(raw.sort);
  const sortDir = normalizeWellnessScoreReportSortDir(
    raw.sortDir ?? raw.sortOrder ?? raw.dir,
    sort,
  );

  const exportAll = raw.exportAll === true
    || raw.exportAll === 'true'
    || raw.exportAll === '1'
    || raw.exportAll === 1;

  return { page, limit, search, teamFilter, sort, sortDir, exportAll };
}

/**
 * @param {number} totalRecords
 * @param {number} page
 * @param {number} pageSize
 */
export function buildWellnessScoreReportPaginationMeta(totalRecords, page, pageSize) {
  const total = Math.max(0, Number(totalRecords) || 0);
  const size = Math.max(1, Number(pageSize) || WELLNESS_SCORE_REPORT_DEFAULT_PAGE_SIZE);
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

/**
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
  // Full Team = active downline only (same as Ideal Weight Report).
  // Logged-in coach appears under Mine, not Full Team.
  return list;
}

/**
 * @param {object|null} self
 * @param {object[]} members
 */
export function countRowsByTeamFilter(self, members) {
  const list = Array.isArray(members) ? members : [];
  const directCount = list.filter((row) => row?.isDirect === true).length;
  return {
    [TEAM_FILTERS.MINE]: self ? 1 : 0,
    [TEAM_FILTERS.DIRECT]: directCount,
    [TEAM_FILTERS.FULL]: list.length,
  };
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
  return list.filter((row) => {
    const name = String(row?.name || row?.userName || '').toLowerCase();
    const sponsor = String(row?.sponsor || '').toLowerCase();
    return name.includes(q) || sponsor.includes(q);
  });
}

function scoreValue(row) {
  // Matches SQL ORDER BY: percentage DESC, computed_at DESC.
  const n = row?.percentage ?? row?.totalEarned ?? row?.wellnessScore;
  if (n == null || n === '') return null;
  const num = Number(n);
  return Number.isFinite(num) ? num : null;
}

function computedAtMs(row) {
  const raw = row?.computedAt ?? row?.computed_at;
  if (!raw) return 0;
  const ms = Date.parse(String(raw));
  return Number.isFinite(ms) ? ms : 0;
}

function numericOrNull(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Compare nullable numbers. Missing values always sort last (both asc & desc).
 * @param {number|null} a
 * @param {number|null} b
 * @param {'asc'|'desc'} sortDir
 * @returns {number}
 */
function compareNullableNumber(a, b, sortDir) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  const delta = a - b;
  return sortDir === SORT_DIRS.ASC ? delta : -delta;
}

/**
 * Compare strings; empty values last.
 * @param {string} a
 * @param {string} b
 * @param {'asc'|'desc'} sortDir
 * @returns {number}
 */
function compareText(a, b, sortDir) {
  const aEmpty = !a;
  const bEmpty = !b;
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;
  const cmp = a.localeCompare(b, undefined, { sensitivity: 'base' });
  return sortDir === SORT_DIRS.ASC ? cmp : -cmp;
}

/**
 * Sort report rows. Null / "—" numeric values always sink to the bottom.
 * Default score order: percentage DESC, then computed_at DESC.
 *
 * @template T
 * @param {T[]} rows
 * @param {string} [sort]
 * @param {'asc'|'desc'} [sortDir]
 * @returns {T[]}
 */
export function sortWellnessScoreReportRows(
  rows,
  sort = SORT_KEYS.SCORE,
  sortDir = DEFAULT_SORT_DIR_BY_KEY[SORT_KEYS.SCORE],
) {
  const list = Array.isArray(rows) ? [...rows] : [];
  const dir = normalizeWellnessScoreReportSortDir(sortDir, sort);
  const key = normalizeWellnessScoreReportSortKey(sort);

  if (key === SORT_KEYS.NAME) {
    list.sort((a, b) =>
      compareText(
        String(a?.name || a?.userName || '').trim(),
        String(b?.name || b?.userName || '').trim(),
        dir,
      ),
    );
    return list;
  }

  if (key === SORT_KEYS.SPONSOR) {
    list.sort((a, b) =>
      compareText(String(a?.sponsor || '').trim(), String(b?.sponsor || '').trim(), dir),
    );
    return list;
  }

  if (key === SORT_KEYS.WEIGHT) {
    list.sort((a, b) =>
      compareNullableNumber(numericOrNull(a?.todayWeight), numericOrNull(b?.todayWeight), dir),
    );
    return list;
  }

  if (key === SORT_KEYS.VS_PREVIOUS) {
    list.sort((a, b) =>
      compareNullableNumber(numericOrNull(a?.difference), numericOrNull(b?.difference), dir),
    );
    return list;
  }

  // Default / score: percentage, then computed_at; null scores last.
  list.sort((a, b) => {
    const primary = compareNullableNumber(scoreValue(a), scoreValue(b), dir);
    if (primary !== 0) return primary;
    const at = computedAtMs(a);
    const bt = computedAtMs(b);
    return dir === SORT_DIRS.ASC ? at - bt : bt - at;
  });
  return list;
}

/**
 * Slim API row — matches the Wellness Score Report contract.
 * @param {object} row
 */
export function toWellnessScoreReportListSummary(row) {
  if (!row) return null;
  const percentage = row.percentage ?? null;
  const totalEarned = row.totalEarned ?? row.wellnessScore ?? null;
  return {
    userId: row.userId,
    name: row.name ?? row.userName ?? null,
    todayWeight: row.todayWeight ?? null,
    previousWeight: row.previousWeight ?? null,
    difference: row.difference ?? null,
    percentage,
    totalEarned,
    wellnessScore: totalEarned,
    wellnessScorePossible: row.wellnessScorePossible ?? null,
    sponsor: row.sponsor ?? null,
    computedAt: row.computedAt ?? null,
    isDirect: row.isDirect === true,
  };
}

/**
 * Filter → sort → slice (or export-all) for Wellness Score Report rows.
 *
 * @param {object|null} self
 * @param {object[]} members
 * @param {{
 *   page?: number,
 *   limit?: number,
 *   search?: string,
 *   teamFilter?: string,
 *   sort?: string,
 *   sortDir?: string,
 *   exportAll?: boolean,
 * }} opts
 */
export function paginateWellnessScoreReportRecords(self, members, opts = {}) {
  const { page, limit, search, teamFilter, sort, sortDir, exportAll } =
    normalizeWellnessScoreReportPagination(opts);

  const teamScopeCounts = countRowsByTeamFilter(self, members);
  const scopeRows = applyTeamFilter(self, members, teamFilter);
  const searched = filterRowsBySearch(scopeRows, search);
  const prepared = sortWellnessScoreReportRows(searched, sort, sortDir);

  if (exportAll) {
    const records = prepared.map(toWellnessScoreReportListSummary).filter(Boolean);
    return {
      records,
      pagination: buildWellnessScoreReportPaginationMeta(records.length, 1, records.length || limit),
      teamScopeCounts,
      teamFilter,
    };
  }

  const pagination = buildWellnessScoreReportPaginationMeta(prepared.length, page, limit);
  const offset = (pagination.currentPage - 1) * pagination.pageSize;
  const pageRows = prepared
    .slice(offset, offset + pagination.pageSize)
    .map(toWellnessScoreReportListSummary)
    .filter(Boolean);

  return {
    records: pageRows,
    pagination,
    teamScopeCounts,
    teamFilter,
  };
}
