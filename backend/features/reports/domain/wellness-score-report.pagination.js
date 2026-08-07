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
});

const TEAM_FILTER_ALIASES = Object.freeze({
  mine: TEAM_FILTERS.MINE,
  self: TEAM_FILTERS.MINE,
  direct: TEAM_FILTERS.DIRECT,
  'direct-team': TEAM_FILTERS.DIRECT,
  full: TEAM_FILTERS.FULL,
  'full-team': TEAM_FILTERS.FULL,
});

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

  // Always default to highest wellness % first (product requirement).
  const sortRaw = String(raw.sort || SORT_KEYS.SCORE).trim().toLowerCase();
  const sort = Object.values(SORT_KEYS).includes(sortRaw) ? sortRaw : SORT_KEYS.SCORE;

  const exportAll = raw.exportAll === true
    || raw.exportAll === 'true'
    || raw.exportAll === '1'
    || raw.exportAll === 1;

  return { page, limit, search, teamFilter, sort, exportAll };
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
  // Full Team = coach + entire active downline (leaderboard must include self,
  // otherwise the coach's own top score e.g. 660 never appears on Full Team).
  if (self) {
    const selfId = Number(self.userId);
    return [self, ...list.filter((row) => Number(row?.userId) !== selfId)];
  }
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
    [TEAM_FILTERS.FULL]: list.length + (self ? 1 : 0),
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
  return n == null || n === '' ? null : Number(n);
}

function computedAtMs(row) {
  const raw = row?.computedAt ?? row?.computed_at;
  if (!raw) return 0;
  const ms = Date.parse(String(raw));
  return Number.isFinite(ms) ? ms : 0;
}

/**
 * total_earned DESC, computed_at DESC; null scores last.
 * @template T
 * @param {T[]} rows
 * @param {string} sort
 * @returns {T[]}
 */
export function sortWellnessScoreReportRows(rows, sort = SORT_KEYS.SCORE) {
  const list = Array.isArray(rows) ? [...rows] : [];
  if (sort === SORT_KEYS.NAME) {
    list.sort((a, b) =>
      String(a?.name || a?.userName || '').localeCompare(String(b?.name || b?.userName || '')),
    );
    return list;
  }
  if (sort === SORT_KEYS.WEIGHT) {
    list.sort((a, b) => {
      const aw = a?.todayWeight;
      const bw = b?.todayWeight;
      if (aw == null && bw == null) return 0;
      if (aw == null) return 1;
      if (bw == null) return -1;
      return Number(bw) - Number(aw);
    });
    return list;
  }

  // Default / score: percentage DESC, then computed_at DESC (SQL pagination contract).
  list.sort((a, b) => {
    const as = scoreValue(a);
    const bs = scoreValue(b);
    if (as == null && bs == null) return 0;
    if (as == null) return 1;
    if (bs == null) return -1;
    if (bs !== as) return bs - as;
    return computedAtMs(b) - computedAtMs(a);
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
 *   exportAll?: boolean,
 * }} opts
 */
export function paginateWellnessScoreReportRecords(self, members, opts = {}) {
  const { page, limit, search, teamFilter, sort, exportAll } =
    normalizeWellnessScoreReportPagination(opts);

  const teamScopeCounts = countRowsByTeamFilter(self, members);
  const scopeRows = applyTeamFilter(self, members, teamFilter);
  const searched = filterRowsBySearch(scopeRows, search);
  const prepared = sortWellnessScoreReportRows(searched, sort);

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
