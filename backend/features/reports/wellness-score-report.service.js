/**
 * wellness-score-report.service.js — Fast paginated Wellness Score Report.
 *
 * Target: <500ms warm / <1s cold for a page of 10.
 * - Roster + ranked scores cached
 * - Full response cached ~20s (kills duplicate/revalidate cost)
 * - Sponsor = 1 name lookup
 * - Weights only for current page (limit 2 / user)
 */
import { validateWellnessScoreReport } from './reports.validators.js';
import {
  getCoachMember,
  getFullTeamMembers,
  getWellnessScoresForUsers,
  getLatestTwoWeightsForUsers,
  getUserNamesByIds,
} from './reports.repository.js';
import {
  applyTeamFilter,
  countRowsByTeamFilter,
  filterRowsBySearch,
  buildWellnessScoreReportPaginationMeta,
  toWellnessScoreReportListSummary,
  sortWellnessScoreReportRows,
  SORT_KEYS,
  TEAM_FILTERS,
} from './domain/wellness-score-report.pagination.js';
import { computeWeightDifferenceKg } from './domain/wellness-score-report.weight.js';
import { isActiveTeamStatus } from '../../utils/teamHierarchyBuilder.js';
import { todayInTimezone, shiftDateYmd, IANA_IST } from '../../shared/lib/datetime/index.js';
import { cache } from '../../utils/cache.js';

const ROSTER_CACHE_TTL_MS = 60_000;
const ROSTER_CACHE_PREFIX = 'reports:wellness-score-roster:v4:';
const RANK_CACHE_TTL_MS = 20_000;
const RANK_CACHE_PREFIX = 'reports:wellness-score-rank:v4:';
const RESPONSE_CACHE_TTL_MS = 20_000;
const RESPONSE_CACHE_PREFIX = 'reports:wellness-score-resp:v5:';
const NAME_CACHE_TTL_MS = 120_000;
const NAME_CACHE_PREFIX = 'reports:wellness-score-name:v3:';
const WEIGHT_CACHE_TTL_MS = 60_000;
const WEIGHT_CACHE_PREFIX = 'reports:wellness-score-weight:v3:';

const EMPTY_LABEL = Object.freeze({
  sponsorName: null,
});

/**
 * @param {number} coachId
 */
async function getWellnessScoreReportRoster(coachId) {
  const cacheKey = `${ROSTER_CACHE_PREFIX}${coachId}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const [coachMember, teamData] = await Promise.all([
    getCoachMember(coachId),
    getFullTeamMembers(coachId),
  ]);

  const fullTeamMembers = teamData.rawMembers.filter((m) => isActiveTeamStatus(m.Status));

  const self = {
    userId: coachMember?.UserId ?? coachId,
    name: coachMember?.UserName || 'You',
    coachId: coachMember?.CoachId ?? null,
    role: coachMember?.Role ?? null,
    isDirect: false,
  };

  const members = fullTeamMembers.map((m) => ({
    userId: m.UserId,
    name: m.UserName || null,
    coachId: m.CoachId ?? null,
    role: m.Role ?? null,
    isDirect: m.isDirectToRoot === true,
  }));

  const roster = { self, members };
  cache.set(cacheKey, roster, ROSTER_CACHE_TTL_MS);
  return roster;
}

/**
 * @param {{
 *   coachId: number,
 *   scoreDate: string,
 *   teamFilter: string,
 *   search: string,
 *   userIds: number[],
 * }} args
 */
async function getRankedScoreRows({ coachId, scoreDate, teamFilter, search, userIds }) {
  const cacheKey = `${RANK_CACHE_PREFIX}${coachId}:${scoreDate}:${teamFilter}:${search}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const ids = [...new Set(userIds.filter((id) => Number.isFinite(id) && id > 0))];
  const scoreMap = await getWellnessScoresForUsers(ids, scoreDate);

  const scored = [];
  const unscored = [];
  for (const userId of ids) {
    const score = scoreMap.get(userId);
    if (score) {
      scored.push({
        userId,
        percentage: score.percentage,
        totalEarned: score.totalEarned,
        totalPossible: score.totalPossible,
        computedAt: score.computedAt,
      });
    } else {
      unscored.push({
        userId,
        percentage: null,
        totalEarned: null,
        totalPossible: null,
        computedAt: null,
      });
    }
  }

  scored.sort((a, b) => {
    if (b.percentage !== a.percentage) return b.percentage - a.percentage;
    const at = a.computedAt ? Date.parse(String(a.computedAt)) : 0;
    const bt = b.computedAt ? Date.parse(String(b.computedAt)) : 0;
    if (bt !== at) return bt - at;
    return a.userId - b.userId;
  });

  const ranked = scored.concat(unscored);
  cache.set(cacheKey, ranked, RANK_CACHE_TTL_MS);
  return ranked;
}

/**
 * Fast Sponsor labels: one team_table name lookup for unique CoachIds.
 *
 * @param {Array<{ userId: number, coachId?: number|null }>} members
 */
async function resolveReportLabelsFast(members) {
  const result = new Map();
  const neededIds = [];

  for (const m of members) {
    const mid = m?.userId != null ? String(m.userId) : null;
    if (!mid) continue;
    const sid = m.coachId != null ? String(m.coachId) : null;
    if (!sid) {
      result.set(mid, EMPTY_LABEL);
      continue;
    }
    const cachedName = cache.get(`${NAME_CACHE_PREFIX}${sid}`);
    if (cachedName !== null && cachedName !== undefined) {
      const name = cachedName === false ? null : cachedName;
      result.set(mid, {
        sponsorName: name,
      });
    } else {
      neededIds.push(Number(sid));
      result.set(mid, { _sponsorId: sid });
    }
  }

  if (neededIds.length > 0) {
    const names = await getUserNamesByIds(neededIds);
    for (const sidNum of neededIds) {
      const sid = String(sidNum);
      const name = names.has(sid) ? (names.get(sid) || null) : null;
      // Store a sentinel so SimpleCache (which treats '' as miss) still remembers lookups.
      cache.set(`${NAME_CACHE_PREFIX}${sid}`, name == null ? false : name, NAME_CACHE_TTL_MS);
    }

    for (const [mid, value] of result.entries()) {
      if (!value?._sponsorId) continue;
      const cached = cache.get(`${NAME_CACHE_PREFIX}${value._sponsorId}`);
      const name = cached === false ? null : (cached || null);
      result.set(mid, {
        sponsorName: name,
      });
    }
  }

  return result;
}

/**
 * @param {object} rosterRow
 * @param {object} pageRow
 * @param {Map} sponsorByUser
 */
function mergePageRow(rosterRow, pageRow, sponsorByUser) {
  const uid = rosterRow.userId;
  const resolved = sponsorByUser.get(String(uid));
  const todayWeight = pageRow?.todayWeight ?? null;
  const previousWeight = pageRow?.previousWeight ?? null;
  const percentage = pageRow?.percentage ?? null;
  const totalEarned = pageRow?.totalEarned ?? null;

  return toWellnessScoreReportListSummary({
    userId: uid,
    name: rosterRow.name || null,
    todayWeight,
    previousWeight,
    difference: computeWeightDifferenceKg(todayWeight, previousWeight),
    percentage,
    totalEarned,
    wellnessScore: totalEarned,
    wellnessScorePossible: pageRow?.totalPossible ?? null,
    computedAt: pageRow?.computedAt ?? null,
    sponsor: resolved?.sponsorName || null,
    isDirect: rosterRow.isDirect === true,
  });
}

/**
 * Latest/previous weights for scoreDate, with per-user+date memory cache.
 * Exact-day semantics: missing day log → todayWeight null (UI "—").
 * @param {number[]} pageIds
 * @param {string} scoreDate YYYY-MM-DD
 */
async function getWeightsCached(pageIds, scoreDate) {
  const result = new Map();
  const missing = [];
  const dateKey = scoreDate || 'latest';

  for (const id of pageIds) {
    const cached = cache.get(`${WEIGHT_CACHE_PREFIX}${id}:${dateKey}`);
    if (cached) {
      result.set(id, cached);
    } else {
      missing.push(id);
    }
  }

  if (missing.length === 0) return result;

  const fetched = await getLatestTwoWeightsForUsers(missing, scoreDate);
  for (const id of missing) {
    const value = fetched.get(id) || {
      todayWeight: null,
      previousWeight: null,
      lastUpdated: null,
    };
    result.set(id, value);
    cache.set(`${WEIGHT_CACHE_PREFIX}${id}:${dateKey}`, value, WEIGHT_CACHE_TTL_MS);
  }
  return result;
}

/**
 * @param {object} rawQuery
 * @returns {Promise<{ httpStatus: number, body: object }>}
 */
async function buildWellnessScoreReport(rawQuery) {
  const {
    coachId,
    page,
    limit,
    search,
    teamFilter,
    sort,
    sortDir,
    exportAll,
    scoreDate: requestedDate,
  } = validateWellnessScoreReport(rawQuery);

  const scoreDate = requestedDate || todayInTimezone(IANA_IST);
  const roster = await getWellnessScoreReportRoster(coachId);

  const teamScopeCounts = countRowsByTeamFilter(roster.self, roster.members);
  const scopeRows = applyTeamFilter(roster.self, roster.members, teamFilter);
  const searched = filterRowsBySearch(scopeRows, search);
  const totalRecords = searched.length;

  const pagination = exportAll
    ? buildWellnessScoreReportPaginationMeta(totalRecords, 1, totalRecords || limit)
    : buildWellnessScoreReportPaginationMeta(totalRecords, page, limit);

  const offset = exportAll ? 0 : (pagination.currentPage - 1) * pagination.pageSize;
  const pageLimit = exportAll ? Math.max(totalRecords, 1) : pagination.pageSize;

  const userIds = searched.map((row) => Number(row.userId)).filter((id) => Number.isFinite(id));
  const ranked = await getRankedScoreRows({
    coachId,
    scoreDate,
    teamFilter,
    search,
    userIds,
  });

  const scoreById = new Map(ranked.map((row) => [Number(row.userId), row]));
  const rosterById = new Map(
    searched.map((row) => [Number(row.userId), row]),
  );

  const needsWeightSort =
    sort === SORT_KEYS.WEIGHT || sort === SORT_KEYS.VS_PREVIOUS;
  const needsSponsorSort = sort === SORT_KEYS.SPONSOR;

  // Fast path: default score DESC — rank then attach page-only weights/sponsors.
  const useScoreFastPath =
    sort === SORT_KEYS.SCORE
    && String(sortDir).toLowerCase() === 'desc'
    && !needsWeightSort
    && !needsSponsorSort;

  /** @type {object[]} */
  let orderedRosterRows;

  if (useScoreFastPath) {
    orderedRosterRows = ranked
      .map((scoreRow) => rosterById.get(Number(scoreRow.userId)))
      .filter(Boolean);
  } else {
    /** @type {object[]} */
    let enriched = searched.map((rosterRow) => {
      const scoreRow = scoreById.get(Number(rosterRow.userId)) || {};
      return {
        ...rosterRow,
        percentage: scoreRow.percentage ?? null,
        totalEarned: scoreRow.totalEarned ?? null,
        totalPossible: scoreRow.totalPossible ?? null,
        computedAt: scoreRow.computedAt ?? null,
        todayWeight: null,
        previousWeight: null,
        difference: null,
        sponsor: null,
      };
    });

    if (needsSponsorSort) {
      const sponsorByUser = await resolveReportLabelsFast(
        enriched.map((row) => ({ userId: row.userId, coachId: row.coachId ?? null })),
      );
      enriched = enriched.map((row) => ({
        ...row,
        sponsor: sponsorByUser.get(String(row.userId))?.sponsorName || null,
      }));
    }

    if (needsWeightSort) {
      const weightMap = await getWeightsCached(
        enriched.map((row) => Number(row.userId)),
        scoreDate,
      );
      enriched = enriched.map((row) => {
        const weights = weightMap.get(Number(row.userId)) || {};
        const todayWeight = weights.todayWeight ?? null;
        const previousWeight = weights.previousWeight ?? null;
        return {
          ...row,
          todayWeight,
          previousWeight,
          difference: computeWeightDifferenceKg(todayWeight, previousWeight),
        };
      });
    }

    orderedRosterRows = sortWellnessScoreReportRows(enriched, sort, sortDir);
  }

  const pageRosterRows = exportAll
    ? orderedRosterRows
    : orderedRosterRows.slice(offset, offset + pageLimit);

  const pageIds = pageRosterRows.map((row) => Number(row.userId));
  const labelMembers = pageRosterRows.map((row) => ({
    userId: row.userId,
    coachId: row.coachId ?? null,
  }));

  // Fetch page weights/sponsors unless already loaded for sorting.
  const weightsAlreadyLoaded = needsWeightSort;
  const sponsorsAlreadyLoaded = needsSponsorSort;

  const [weightMap, sponsorByUser] = await Promise.all([
    weightsAlreadyLoaded
      ? Promise.resolve(new Map(pageRosterRows.map((row) => [
        Number(row.userId),
        {
          todayWeight: row.todayWeight ?? null,
          previousWeight: row.previousWeight ?? null,
          lastUpdated: null,
        },
      ])))
      : getWeightsCached(pageIds, scoreDate),
    sponsorsAlreadyLoaded
      ? Promise.resolve(new Map(pageRosterRows.map((row) => [
        String(row.userId),
        { sponsorName: row.sponsor ?? null },
      ])))
      : resolveReportLabelsFast(labelMembers),
  ]);

  const records = pageRosterRows
    .map((rosterRow) => {
      const scoreRow = scoreById.get(Number(rosterRow.userId)) || {};
      const weights = weightMap.get(Number(rosterRow.userId)) || {};
      return mergePageRow(
        rosterRow,
        {
          ...scoreRow,
          todayWeight: weights.todayWeight ?? rosterRow.todayWeight ?? null,
          previousWeight: weights.previousWeight ?? rosterRow.previousWeight ?? null,
        },
        sponsorByUser,
      );
    })
    .filter(Boolean);

  return {
    httpStatus: 200,
    body: {
      success: true,
      data: {
        members: records,
        teamScopeCounts,
        teamFilter: teamFilter || TEAM_FILTERS.DIRECT,
        scoreDate,
        sort,
        sortDir,
        page: pagination.page,
        limit: pagination.limit,
        totalRecords: pagination.totalRecords,
        totalPages: pagination.totalPages,
        hasNextPage: pagination.hasNextPage,
        hasPreviousPage: pagination.hasPreviousPage,
      },
      pagination,
    },
  };
}

/**
 * Warm yesterday page-1 response in background after Today (non-blocking).
 */
function warmYesterdayReport(rawQuery, todayYmd) {
  try {
    const yesterday = shiftDateYmd(todayYmd, -1, IANA_IST);
    void getWellnessScoreReport({
      ...rawQuery,
      date: yesterday,
      page: '1',
      exportAll: undefined,
    }).catch(() => {});
  } catch {
    /* ignore warm failures */
  }
}

/**
 * GET /api/reports/wellness-score-report
 *
 * @param {object} rawQuery
 * @returns {{ httpStatus: number, body: object }}
 */
export async function getWellnessScoreReport(rawQuery) {
  const {
    coachId,
    page,
    limit,
    search,
    teamFilter,
    sort,
    sortDir,
    exportAll,
    scoreDate: requestedDate,
  } = validateWellnessScoreReport(rawQuery);

  const scoreDate = requestedDate || todayInTimezone(IANA_IST);
  const responseKey = [
    RESPONSE_CACHE_PREFIX,
    coachId,
    scoreDate,
    teamFilter,
    search,
    sort,
    sortDir,
    exportAll ? 'all' : page,
    exportAll ? 'all' : limit,
  ].join(':');

  if (!exportAll) {
    const cached = cache.get(responseKey);
    if (cached) return cached;
  }

  const result = await buildWellnessScoreReport(rawQuery);
  if (!exportAll) {
    cache.set(responseKey, result, RESPONSE_CACHE_TTL_MS);
    // After Today page 1, warm Yesterday in background so the date pill is instant.
    if (Number(page) === 1 && scoreDate === todayInTimezone(IANA_IST)) {
      warmYesterdayReport(rawQuery, scoreDate);
    }
  }
  return result;
}
