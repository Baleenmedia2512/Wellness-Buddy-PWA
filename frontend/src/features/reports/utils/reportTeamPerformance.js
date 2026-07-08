/**
 * reportTeamPerformance.js — Team performance summaries on coach cards
 * in the Ideal Weight Report.
 *
 * - Mine tab: logged-in coach card shows full-team score (all active downline).
 * - Direct / Full: only coaches who manage a team show a score on their card.
 *
 * Uses the full members payload from a single API fetch; no extra requests.
 */
import { countRowsByStatus, TEAM_SCOPES } from './reportFilters.js';

/** Normalise user ids so map lookups work across string/number API values. */
export function normalizeUserId(id) {
  if (id == null) return null;
  const parsed = Number(id);
  return Number.isNaN(parsed) ? id : parsed;
}

/** Build coachId → direct-child userId adjacency list. */
export function buildChildrenIndex(members) {
  const index = new Map();
  for (const row of members) {
    // Hierarchy parent for scope filters; DB CoachId for team-performance fallback.
    const parentId = normalizeUserId(
      row?.coachId ?? row?.reportsToCoachId ?? row?.CoachId,
    );
    const userId = normalizeUserId(row?.userId ?? row?.UserId);
    if (parentId == null || userId == null) continue;
    if (!index.has(parentId)) index.set(parentId, []);
    index.get(parentId).push(userId);
  }
  return index;
}

/**
 * Collect every descendant row under a coach (entire subtree, coach excluded).
 * Visited set prevents duplicate members when traversing the hierarchy.
 */
export function collectDescendantRows(coachUserId, members, childrenIndex) {
  const normalizedCoachId = normalizeUserId(coachUserId);
  const memberById = new Map(
    members
      .filter((row) => (row?.userId ?? row?.UserId) != null)
      .map((row) => [normalizeUserId(row.userId ?? row.UserId), row]),
  );
  const visited = new Set();
  const result = [];
  const queue = [...(childrenIndex.get(normalizedCoachId) || [])];

  while (queue.length > 0) {
    const userId = queue.shift();
    if (visited.has(userId)) continue;
    visited.add(userId);

    const row = memberById.get(userId);
    if (row) result.push(row);

    const children = childrenIndex.get(userId);
    if (children?.length) queue.push(...children);
  }

  return result;
}

function toPercentage(count, total) {
  if (!total) return 0;
  return Math.round((count / total) * 100);
}

/** Derive on/off/no-data counts and percentages from descendant rows. */
export function computeTeamPerformanceSummary(rows) {
  if (!rows?.length) return null;

  const counts = countRowsByStatus(rows);
  const total = counts.all;

  return {
    totalMembers: total,
    onTrack: counts.on_track,
    onTrackPct: toPercentage(counts.on_track, total),
    offTrack: counts.off_track,
    offTrackPct: toPercentage(counts.off_track, total),
    noData: counts.no_data,
    noDataPct: toPercentage(counts.no_data, total),
  };
}

/**
 * Map coach userId → team performance summary for every member who has downline.
 * Includes nested coaches on the Full Team tab, not only direct-to-root coaches.
 */
export function buildTeamPerformanceByUserId(members) {
  if (!Array.isArray(members) || members.length === 0) return {};

  const childrenIndex = buildChildrenIndex(members);
  const summaries = {};

  for (const member of members) {
    const memberId = normalizeUserId(member?.userId ?? member?.UserId);
    if (memberId == null) continue;

    const descendants = collectDescendantRows(memberId, members, childrenIndex);
    const summary = computeTeamPerformanceSummary(descendants);
    if (summary) summaries[memberId] = summary;
  }

  return summaries;
}

/**
 * Resolve the team score to render on a member card for the active scope.
 *
 * Mine  → logged-in coach card only; score covers the entire active downline.
 * Direct / Full → score only when this row manages a team (has downline).
 */
export function resolveRowTeamPerformance({
  row,
  teamScope,
  self,
  loggedInCoachId,
  teamPerformanceByUserId = {},
}) {
  const rowId = normalizeUserId(row?.userId ?? row?.UserId);
  const coachId = normalizeUserId(loggedInCoachId);
  if (rowId == null) return null;

  const fromRow = row?.teamPerformance ?? teamPerformanceByUserId[rowId] ?? null;

  if (teamScope === TEAM_SCOPES.MINE && rowId === coachId) {
    return self?.teamPerformance ?? fromRow;
  }

  return fromRow;
}
