/**
 * reportTeamPerformance.js — Team performance summaries for coach cards
 * in the Ideal Weight Report (Direct tab coaches with downline).
 *
 * Uses the full members payload from a single API fetch; no extra requests.
 */
import { countRowsByStatus } from './reportFilters.js';

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
    const parentId = normalizeUserId(row?.coachId ?? row?.CoachId);
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
 * Map direct coach userId → team performance summary for coaches with downline.
 * Only direct members of the logged-in coach are included (isDirect !== false).
 */
export function buildTeamPerformanceByUserId(members) {
  if (!Array.isArray(members) || members.length === 0) return {};

  const childrenIndex = buildChildrenIndex(members);
  const summaries = {};

  for (const member of members) {
    if (member?.isDirect === false) continue;

    const memberId = normalizeUserId(member?.userId ?? member?.UserId);
    if (memberId == null) continue;

    const descendants = collectDescendantRows(memberId, members, childrenIndex);
    const summary = computeTeamPerformanceSummary(descendants);
    if (summary) summaries[memberId] = summary;
  }

  return summaries;
}
