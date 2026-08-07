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
  TEAM_FILTERS,
} from './domain/wellness-score-report.pagination.js';
import { computeWeightDifferenceKg } from './domain/wellness-score-report.weight.js';
import { isActiveTeamStatus } from '../../utils/teamHierarchyBuilder.js';
import { todayInTimezone, IANA_IST } from '../../shared/lib/datetime/index.js';
import { cache } from '../../utils/cache.js';

const ROSTER_CACHE_TTL_MS = 60_000;
const ROSTER_CACHE_PREFIX = 'reports:wellness-score-roster:v3:';
const RANK_CACHE_TTL_MS = 20_000;
const RANK_CACHE_PREFIX = 'reports:wellness-score-rank:v3:';
const RESPONSE_CACHE_TTL_MS = 20_000;
const RESPONSE_CACHE_PREFIX = 'reports:wellness-score-resp:v3:';
const NAME_CACHE_TTL_MS = 120_000;
const NAME_CACHE_PREFIX = 'reports:wellness-score-name:v3:';

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
 * @param {object} rawQuery
 * @returns {{ httpStatus: number, body: object }}
 */
async function buildWellnessScoreReport(rawQuery) {
  const {
    coachId,
    page,
    limit,
    search,
    teamFilter,
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

  const pageScoreRows = exportAll
    ? ranked
    : ranked.slice(offset, offset + pageLimit);

  const rosterById = new Map(
    searched.map((row) => [Number(row.userId), row]),
  );

  const pageIds = pageScoreRows.map((row) => Number(row.userId));
  const labelMembers = pageScoreRows.map((row) => {
    const rosterRow = rosterById.get(Number(row.userId));
    return {
      userId: row.userId,
      coachId: rosterRow?.coachId ?? null,
    };
  });

  const [weightMap, sponsorByUser] = await Promise.all([
    getLatestTwoWeightsForUsers(pageIds),
    resolveReportLabelsFast(labelMembers),
  ]);

  const records = pageScoreRows
    .map((pageRow) => {
      const rosterRow = rosterById.get(Number(pageRow.userId));
      if (!rosterRow) return null;
      const weights = weightMap.get(Number(pageRow.userId)) || {};
      return mergePageRow(
        rosterRow,
        {
          ...pageRow,
          todayWeight: weights.todayWeight ?? null,
          previousWeight: weights.previousWeight ?? null,
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
  }
  return result;
}
