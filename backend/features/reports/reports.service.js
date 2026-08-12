/**
 * reports.service.js — Business logic for the Reports feature.
 * Zero HTTP concerns. Orchestrates: validation → data → domain → response shape.
 */
import { validateDownlineWeightStatus } from './reports.validators.js';
import {
  getCoachMember,
  getFullTeamMembers,
  getLatestWeightsForUsers,
} from './reports.repository.js';
import { computeIdealWeightRange } from '../../utils/weightValidation.js';
import { paginateDownlineWeightRecords } from './domain/downline-weight.pagination.js';
import { cache } from '../../utils/cache.js';

/** Short TTL so page/filter changes reuse the expensive hierarchy+weight build. */
const REPORT_BUILD_CACHE_TTL_MS = 20_000;
const REPORT_BUILD_CACHE_PREFIX = 'reports:downline-weight:v1:';

/**
 * Classify a member's weight status relative to their ideal range.
 * @param {number|null} currentWeight
 * @param {{ idealMin: number, idealMax: number }|null} idealRange
 * @returns {'above_ideal'|'below_ideal'|'on_track'|'no_weight'|'no_height'}
 */
function classifyStatus(currentWeight, idealRange) {
  if (!idealRange) return 'no_height';
  if (currentWeight === null || currentWeight === undefined) return 'no_weight';
  if (currentWeight > idealRange.idealMax) return 'above_ideal';
  if (currentWeight < idealRange.idealMin) return 'below_ideal';
  return 'on_track';
}

const OFF_TRACK_STATUSES = new Set(['above_ideal', 'below_ideal']);
const NO_DATA_STATUSES = new Set(['no_weight', 'no_height']);

function toPercentage(count, total) {
  if (!total) return 0;
  return Math.round((count / total) * 100);
}

function countWeightRowsByStatus(rows) {
  const counts = { off_track: 0, on_track: 0, no_data: 0, all: rows.length };
  for (const row of rows) {
    if (OFF_TRACK_STATUSES.has(row.status)) counts.off_track += 1;
    else if (row.status === 'on_track') counts.on_track += 1;
    else if (NO_DATA_STATUSES.has(row.status)) counts.no_data += 1;
    else counts.no_data += 1;
  }
  return counts;
}

function computeTeamPerformanceSummary(rows) {
  if (!rows?.length) return null;
  const counts = countWeightRowsByStatus(rows);
  return {
    totalMembers: counts.all,
    onTrack: counts.on_track,
    onTrackPct: toPercentage(counts.on_track, counts.all),
    offTrack: counts.off_track,
    offTrackPct: toPercentage(counts.off_track, counts.all),
    noData: counts.no_data,
    noDataPct: toPercentage(counts.no_data, counts.all),
  };
}

/** Adjacency list from team_table CoachId (who each active member reports to). */
function buildDbCoachChildrenIndex(rawMembers) {
  const index = new Map();
  for (const m of rawMembers) {
    const parentId = Number(m.CoachId);
    const userId = Number(m.UserId);
    if (!Number.isFinite(parentId) || !Number.isFinite(userId)) continue;
    if (!index.has(parentId)) index.set(parentId, []);
    if (!index.get(parentId).includes(userId)) index.get(parentId).push(userId);
  }
  return index;
}

/** Adjacency list from hierarchy parent (tree parent used by the reports UI). */
function buildHierarchyParentIndex(rawMembers) {
  const index = new Map();
  for (const m of rawMembers) {
    const parentId = Number(m.HierarchyParent ?? m.CoachId);
    const userId = Number(m.UserId);
    if (!Number.isFinite(parentId) || !Number.isFinite(userId)) continue;
    if (!index.has(parentId)) index.set(parentId, []);
    if (!index.get(parentId).includes(userId)) index.get(parentId).push(userId);
  }
  return index;
}

function mergeChildrenIndexes(...indexes) {
  const merged = new Map();
  for (const index of indexes) {
    for (const [parentId, childIds] of index) {
      const parent = Number(parentId);
      if (!Number.isFinite(parent)) continue;
      if (!merged.has(parent)) merged.set(parent, []);
      const bucket = merged.get(parent);
      for (const childId of childIds) {
        const child = Number(childId);
        if (Number.isFinite(child) && !bucket.includes(child)) bucket.push(child);
      }
    }
  }
  return merged;
}

/** All active descendant userIds under a coach. */
function collectDescendantUserIds(coachUserId, childrenIndex) {
  const root = Number(coachUserId);
  const visited = new Set();
  const result = [];
  const queue = [...(childrenIndex.get(root) || [])];

  while (queue.length > 0) {
    const id = Number(queue.shift());
    if (!Number.isFinite(id) || visited.has(id)) continue;
    visited.add(id);
    result.push(id);
    const kids = childrenIndex.get(id);
    if (kids?.length) queue.push(...kids);
  }
  return result;
}

/**
 * Per-coach team stats from hierarchy + DB links (active members only).
 * Uses the same tree as team-hierarchy so sub-coach cards (e.g. Adithya) match reality.
 */
function buildTeamPerformanceByCoachId(rawMembers, weightRows, childrenByParentId) {
  const childrenIndex = mergeChildrenIndexes(
    childrenByParentId,
    buildHierarchyParentIndex(rawMembers),
    buildDbCoachChildrenIndex(rawMembers),
  );
  const rowById = new Map(weightRows.map((r) => [Number(r.userId), r]));
  const performanceById = {};

  const coachCandidates = new Set([
    ...rawMembers.map((m) => Number(m.UserId)),
    ...childrenIndex.keys(),
  ]);

  for (const coachUserId of coachCandidates) {
    if (!Number.isFinite(coachUserId)) continue;
    const descIds = collectDescendantUserIds(coachUserId, childrenIndex);
    const descRows = descIds.map((id) => rowById.get(id)).filter(Boolean);
    const summary = computeTeamPerformanceSummary(descRows);
    if (summary) performanceById[coachUserId] = summary;
  }

  return performanceById;
}

function readWeightEntry(weightMap, userId) {
  const entry = weightMap.get(userId);
  if (entry == null) return { currentWeight: null, lastUpdated: null };
  if (typeof entry === 'object' && !Array.isArray(entry)) {
    return {
      currentWeight: entry.weight ?? null,
      lastUpdated: entry.lastUpdated ?? null,
    };
  }
  return { currentWeight: entry, lastUpdated: null };
}

function buildWeightRow(member, weightMap) {
  const { currentWeight, lastUpdated } = readWeightEntry(weightMap, member.UserId);
  const idealRange = computeIdealWeightRange(member.Height);
  const status = classifyStatus(currentWeight, idealRange);

  return {
    userId: member.UserId,
    userName: member.UserName,
    currentWeight,
    idealMin: idealRange?.idealMin ?? null,
    idealMax: idealRange?.idealMax ?? null,
    status,
    lastUpdated,
  };
}

/**
 * Build the full enriched report once per coach (cached ~20s).
 * Pagination/filters are applied in memory on top of this snapshot.
 *
 * @param {number} coachId
 * @returns {Promise<{ self: object, members: object[] }>}
 */
async function buildDownlineWeightSnapshot(coachId) {
  const cacheKey = `${REPORT_BUILD_CACHE_PREFIX}${coachId}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const [coachMember, teamData] = await Promise.all([
    getCoachMember(coachId),
    getFullTeamMembers(coachId),
  ]);
  const fullTeamMembers = teamData.rawMembers;
  const childrenByParentId = teamData.childrenByParentId;

  const userIds = [
    coachId,
    ...fullTeamMembers.map((m) => m.UserId),
  ];
  const weightMap = await getLatestWeightsForUsers(userIds);

  const selfMember = coachMember || {
    UserId: coachId,
    UserName: 'You',
    Height: null,
  };
  const selfBase = buildWeightRow(selfMember, weightMap);

  const members = fullTeamMembers.map((m) => ({
    ...buildWeightRow(m, weightMap),
    isDirect: m.isDirectToRoot === true,
    coachId: m.HierarchyParent ?? m.CoachId,
    reportsToCoachId: m.CoachId,
  }));

  const teamPerformanceByUserId = buildTeamPerformanceByCoachId(
    fullTeamMembers,
    members,
    childrenByParentId,
  );

  const membersWithPerformance = members.map((m) => ({
    ...m,
    teamPerformance: teamPerformanceByUserId[Number(m.userId)] ?? null,
  }));

  const snapshot = {
    self: {
      ...selfBase,
      isDirect: false,
      coachId: null,
      reportsToCoachId: null,
      teamPerformance: teamPerformanceByUserId[coachId] ?? null,
    },
    members: membersWithPerformance,
  };

  cache.set(cacheKey, snapshot, REPORT_BUILD_CACHE_TTL_MS);
  return snapshot;
}

/**
 * GET /api/reports/downline-weight-status
 *
 * Returns a paginated page of weight-status rows for the selected team/status/
 * search filters. Aggregate chip counts always reflect the full scoped set.
 *
 * @param {object} rawQuery
 * @returns {{ httpStatus: number, body: object }}
 */
export async function getDownlineWeightStatus(rawQuery) {
  const {
    coachId,
    page,
    limit,
    search,
    teamFilter,
    statusFilter,
    sort,
  } = validateDownlineWeightStatus(rawQuery);

  const snapshot = await buildDownlineWeightSnapshot(coachId);
  const {
    records,
    pagination,
    statusCounts,
    teamScopeCounts,
    teamFilter: resolvedTeamFilter,
    statusFilter: resolvedStatusFilter,
  } = paginateDownlineWeightRecords(snapshot.self, snapshot.members, {
    page,
    limit,
    search,
    teamFilter,
    statusFilter,
    sort,
  });

  // Slim self for Mine tab / team-performance header (always present, not paginated away).
  const selfSummary = {
    userId: snapshot.self.userId,
    userName: snapshot.self.userName,
    currentWeight: snapshot.self.currentWeight,
    idealMin: snapshot.self.idealMin,
    idealMax: snapshot.self.idealMax,
    status: snapshot.self.status,
    difference: null,
    lastUpdated: snapshot.self.lastUpdated ?? null,
    teamPerformance: snapshot.self.teamPerformance ?? null,
  };
  if (
    selfSummary.currentWeight != null
    && selfSummary.idealMin != null
    && selfSummary.idealMax != null
  ) {
    if (selfSummary.status === 'above_ideal') {
      selfSummary.difference = Number(
        (selfSummary.currentWeight - selfSummary.idealMax).toFixed(1),
      );
    } else if (selfSummary.status === 'below_ideal') {
      selfSummary.difference = Number(
        (selfSummary.idealMin - selfSummary.currentWeight).toFixed(1),
      );
    } else {
      selfSummary.difference = 0;
    }
  }

  return {
    httpStatus: 200,
    body: {
      success: true,
      data: {
        self: selfSummary,
        members: records,
        statusCounts,
        teamScopeCounts,
        teamFilter: resolvedTeamFilter,
        statusFilter: resolvedStatusFilter,
        // Flat pagination fields (client + docs convenience)
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
