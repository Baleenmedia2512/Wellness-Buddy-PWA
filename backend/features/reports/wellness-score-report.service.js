/**
 * wellness-score-report.service.js — Paginated Wellness Score Report (perf path).
 *
 * Hot path:
 *  1) Cached roster
 *  2) Cached ranked scores for (coach, date, filter, search) — page flips reuse it
 *  3) Parallel: page weights + unique-sponsor label resolve (cached by sponsorId)
 */
import { validateWellnessScoreReport } from './reports.validators.js';
import {
  getCoachMember,
  getFullTeamMembers,
  getWellnessScoresForUsers,
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
const ROSTER_CACHE_PREFIX = 'reports:wellness-score-roster:v2:';
const RANK_CACHE_TTL_MS = 20_000;
const RANK_CACHE_PREFIX = 'reports:wellness-score-rank:v2:';
const SPONSOR_BY_ID_TTL_MS = 120_000;
const SPONSOR_BY_ID_PREFIX = 'reports:wellness-score-sponsor-id:v2:';

const EMPTY_LABEL = Object.freeze({
  sponsorId: null,
  sponsorName: null,
  idealCoachId: null,
  idealCoachName: null,
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
 * Build / reuse ranked score rows for a coach scope (no weights/sponsors).
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
 * Resolve labels once per unique sponsorId (shared across members + pages).
 * @param {Array<{ userId: number, coachId?: number|null, role?: string|null }>} members
 */
async function resolveSponsorsByUniqueCoach(members) {
  const result = new Map();
  /** @type {Map<string, Array<{ userId: number, coachId: number|null, role?: string|null }>>} */
  const bySponsor = new Map();

  for (const m of members) {
    const mid = m?.userId != null ? String(m.userId) : null;
    if (!mid) continue;
    const sid = m.coachId != null ? String(m.coachId) : null;
    if (!sid) {
      result.set(mid, EMPTY_LABEL);
      continue;
    }
    if (!bySponsor.has(sid)) bySponsor.set(sid, []);
    bySponsor.get(sid).push(m);
  }

  const missingProbes = [];
  /** @type {Map<string, object>} */
  const labelBySponsor = new Map();

  for (const sid of bySponsor.keys()) {
    const cached = cache.get(`${SPONSOR_BY_ID_PREFIX}${sid}`);
    if (cached) {
      labelBySponsor.set(sid, cached);
    } else {
      const probe = bySponsor.get(sid)[0];
      missingProbes.push(probe);
    }
  }

  if (missingProbes.length > 0) {
    const resolved = await resolveSponsorAndIdealCoachForMembers(missingProbes);
    for (const probe of missingProbes) {
      const mid = String(probe.userId);
      const sid = String(probe.coachId);
      const value = resolved.get(mid) || EMPTY_LABEL;
      const label = {
        sponsorId: value.sponsorId ?? sid,
        sponsorName: value.sponsorName ?? null,
        idealCoachId: value.idealCoachId ?? null,
        idealCoachName: value.idealCoachName ?? null,
      };
      labelBySponsor.set(sid, label);
      cache.set(`${SPONSOR_BY_ID_PREFIX}${sid}`, label, SPONSOR_BY_ID_TTL_MS);
    }
  }

  for (const [sid, group] of bySponsor.entries()) {
    const label = labelBySponsor.get(sid) || EMPTY_LABEL;
    for (const m of group) {
      result.set(String(m.userId), label);
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
    resolveSponsorsByUniqueCoach(sponsorMembers),
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
