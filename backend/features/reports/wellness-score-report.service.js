/**
 * wellness-score-report.service.js — Single-request Wellness Score Report.
 *
 * One snapshot build per coach (cached): hierarchy + latest/previous weights +
 * today's wellness_score_daily_table.percentage + sponsor/ideal-coach labels.
 *
 * Active users only. Ordered percentage DESC, computed_at DESC.
 */
import { validateWellnessScoreReport } from './reports.validators.js';
import {
  getCoachMember,
  getFullTeamMembers,
  getLatestTwoWeightsForUsers,
  getWellnessScoresForUsers,
} from './reports.repository.js';
import {
  paginateWellnessScoreReportRecords,
  SORT_KEYS,
} from './domain/wellness-score-report.pagination.js';
import { computeWeightDifferenceKg } from './domain/wellness-score-report.weight.js';
import { resolveSponsorAndIdealCoachForMembers } from '../../utils/sponsorCoachResolution.js';
import { isActiveTeamStatus } from '../../utils/teamHierarchyBuilder.js';
import { todayInTimezone, IANA_IST } from '../../shared/lib/datetime/index.js';
import { cache } from '../../utils/cache.js';

const REPORT_BUILD_CACHE_TTL_MS = 20_000;
const REPORT_BUILD_CACHE_PREFIX = 'reports:wellness-score:v6:';

function readWeightPair(weightMap, userId) {
  const id = Number(userId);
  const entry = weightMap.get(id) || weightMap.get(userId);
  if (!entry) return { todayWeight: null, previousWeight: null };
  return {
    todayWeight: entry.todayWeight ?? null,
    previousWeight: entry.previousWeight ?? null,
  };
}

function buildMemberRow(member, weightMap, scoreMap, sponsorByUser) {
  const uid = member.UserId;
  const uidNum = Number(uid);
  const { todayWeight, previousWeight } = readWeightPair(weightMap, uid);
  const score = scoreMap.get(uidNum) || scoreMap.get(uid) || null;
  const resolved = sponsorByUser.get(String(uid));
  const percentage = score != null ? score.percentage : null;
  const totalEarned = score != null ? score.totalEarned : null;
  const difference = computeWeightDifferenceKg(todayWeight, previousWeight);

  return {
    userId: uid,
    name: member.UserName || null,
    todayWeight,
    previousWeight,
    difference,
    percentage,
    totalEarned,
    wellnessScore: totalEarned,
    wellnessScorePossible: score?.totalPossible ?? null,
    computedAt: score?.computedAt ?? null,
    sponsor: resolved?.sponsorName || null,
    coach: resolved?.idealCoachName || null,
    isDirect: member.isDirectToRoot === true,
  };
}

/**
 * Build enriched report once per coach + score date (cached ~20s).
 * @param {number} coachId
 * @param {string} scoreDate
 */
async function buildWellnessScoreReportSnapshot(coachId, scoreDate) {
  const cacheKey = `${REPORT_BUILD_CACHE_PREFIX}${coachId}:${scoreDate}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const [coachMember, teamData] = await Promise.all([
    getCoachMember(coachId),
    getFullTeamMembers(coachId),
  ]);
  const fullTeamMembers = teamData.rawMembers.filter((m) => isActiveTeamStatus(m.Status));
  const selfIsActive = !coachMember || isActiveTeamStatus(coachMember.Status);

  const userIds = [
    ...(selfIsActive ? [coachId] : []),
    ...fullTeamMembers.map((m) => m.UserId),
  ];

  const [weightMap, scoreMap] = await Promise.all([
    getLatestTwoWeightsForUsers(userIds),
    getWellnessScoresForUsers(userIds, scoreDate),
  ]);

  const sponsorMembers = [
    ...(selfIsActive
      ? [{
          userId: coachId,
          coachId: coachMember?.CoachId ?? null,
          role: coachMember?.Role ?? null,
        }]
      : []),
    ...fullTeamMembers.map((m) => ({
      userId: m.UserId,
      coachId: m.CoachId,
      role: m.Role,
    })),
  ];
  const sponsorByUser = await resolveSponsorAndIdealCoachForMembers(sponsorMembers);

  const selfMember = coachMember || {
    UserId: coachId,
    UserName: 'You',
    CoachId: null,
    isDirectToRoot: false,
  };

  const self = selfIsActive
    ? {
        ...buildMemberRow(
          { ...selfMember, isDirectToRoot: false },
          weightMap,
          scoreMap,
          sponsorByUser,
        ),
        isDirect: false,
      }
    : null;

  const members = fullTeamMembers.map((m) =>
    buildMemberRow(m, weightMap, scoreMap, sponsorByUser),
  );

  const snapshot = { self, members, scoreDate };
  cache.set(cacheKey, snapshot, REPORT_BUILD_CACHE_TTL_MS);
  return snapshot;
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

  // Always today's IST business date unless an explicit date is passed.
  const scoreDate = requestedDate || todayInTimezone(IANA_IST);
  const snapshot = await buildWellnessScoreReportSnapshot(coachId, scoreDate);

  const {
    records,
    pagination,
    teamScopeCounts,
    teamFilter: resolvedTeamFilter,
  } = paginateWellnessScoreReportRecords(snapshot.self, snapshot.members, {
    page,
    limit,
    search,
    teamFilter,
    // Server-owned sort: percentage DESC, computed_at DESC — no client sort.
    sort: SORT_KEYS.SCORE,
    exportAll,
  });

  return {
    httpStatus: 200,
    body: {
      success: true,
      data: {
        members: records,
        teamScopeCounts,
        teamFilter: resolvedTeamFilter,
        scoreDate: snapshot.scoreDate,
        page: pagination.page,
        limit: pagination.limit,
        totalRecords: pagination.totalRecords,
        totalPages: pagination.totalPages,
        hasNextPage: pagination.hasNextPage,
      },
      pagination,
    },
  };
}
