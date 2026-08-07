/**
 * wellness-score-report.service.js — Paginated Wellness Score Report.
 *
 * Roster cached lightly. Per page:
 *  1) score rank/slice for scoped users
 *  2) weights + sponsor/coach labels in parallel for page ids only
 */
import { validateWellnessScoreReport } from './reports.validators.js';
import {
  getCoachMember,
  getFullTeamMembers,
  fetchWellnessScoreReportPage,
  getLatestTwoWeightsForUsers,
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
import { resolveSponsorAndIdealCoachForMembers } from '../../utils/sponsorCoachResolution.js';
import { isActiveTeamStatus } from '../../utils/teamHierarchyBuilder.js';
import { todayInTimezone, IANA_IST } from '../../shared/lib/datetime/index.js';
import { cache } from '../../utils/cache.js';

const ROSTER_CACHE_TTL_MS = 60_000;
const ROSTER_CACHE_PREFIX = 'reports:wellness-score-roster:v1:';
const SPONSOR_CACHE_TTL_MS = 60_000;
const SPONSOR_CACHE_PREFIX = 'reports:wellness-score-sponsor:v1:';

/**
 * Lightweight active-team roster (no scores/weights). Cached per coach.
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
 * Resolve sponsors with a short per-member cache to avoid repeat chain walks.
 * @param {Array<{ userId: number, coachId?: number|null, role?: string|null }>} members
 */
async function resolveSponsorsCached(members) {
  const result = new Map();
  const missing = [];

  for (const m of members) {
    const key = `${SPONSOR_CACHE_PREFIX}${m.userId}`;
    const cached = cache.get(key);
    if (cached) {
      result.set(String(m.userId), cached);
    } else {
      missing.push(m);
    }
  }

  if (missing.length === 0) return result;

  const resolved = await resolveSponsorAndIdealCoachForMembers(missing);
  for (const m of missing) {
    const mid = String(m.userId);
    const value = resolved.get(mid) || {
      sponsorId: null,
      sponsorName: null,
      idealCoachId: null,
      idealCoachName: null,
    };
    result.set(mid, value);
    cache.set(`${SPONSOR_CACHE_PREFIX}${m.userId}`, value, SPONSOR_CACHE_TTL_MS);
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
    coach: resolved?.idealCoachName || null,
    isDirect: rosterRow.isDirect === true,
  });
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
  const pageScoreRows = await fetchWellnessScoreReportPage({
    userIds,
    scoreDate,
    limit: pageLimit,
    offset,
    exportAll,
  });

  const rosterById = new Map(
    searched.map((row) => [Number(row.userId), row]),
  );

  const pageIds = pageScoreRows.map((row) => Number(row.userId));
  const sponsorMembers = pageScoreRows.map((row) => {
    const rosterRow = rosterById.get(Number(row.userId));
    return {
      userId: row.userId,
      coachId: rosterRow?.coachId ?? null,
      role: rosterRow?.role ?? null,
    };
  });

  const [weightMap, sponsorByUser] = await Promise.all([
    getLatestTwoWeightsForUsers(pageIds),
    resolveSponsorsCached(sponsorMembers),
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
