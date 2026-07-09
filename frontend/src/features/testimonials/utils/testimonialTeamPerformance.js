/**
 * testimonialTeamPerformance.js — Per-coach team upload scores on member cards.
 * Mirrors the Reports dashboard team score pattern for testimonials.
 */
import { TEAM_SCOPES } from './testimonialFilters.js';

export function normalizeUserId(id) {
  if (id == null) return null;
  const parsed = Number(id);
  return Number.isNaN(parsed) ? id : parsed;
}

function lookupTeamPerformance(teamPerformanceByUserId, userId) {
  if (!teamPerformanceByUserId || userId == null) return null;
  return teamPerformanceByUserId[userId] ?? teamPerformanceByUserId[String(userId)] ?? null;
}

/**
 * Resolve overall team compliance for a member card (full downline under that coach).
 */
export function resolveRowTeamUploadPerformance({
  row,
  teamScope,
  loggedInCoachId,
  teamPerformanceByUserId = {},
  reportType = 'photo',
}) {
  const rowId = normalizeUserId(row?.user?.userId ?? row?.userId);
  const coachId = normalizeUserId(loggedInCoachId);
  if (rowId == null) return null;

  const entry = lookupTeamPerformance(teamPerformanceByUserId, rowId);
  const bucket = entry?.[reportType];
  const stats = bucket?.directTeam ?? bucket?.fullTeam ?? bucket;
  if (!stats?.totalMembers) return null;

  if (teamScope === TEAM_SCOPES.MINE && rowId !== coachId) {
    return null;
  }

  return stats;
}
