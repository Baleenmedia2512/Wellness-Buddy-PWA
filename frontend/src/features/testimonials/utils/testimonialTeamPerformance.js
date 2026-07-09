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
 * Resolve the team upload score to show on a member card.
 *
 * Mine  → logged-in coach card shows full-team upload %.
 * Direct / Full → coaches who manage a team show their downline upload %.
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
  const stats = entry?.[reportType] ?? null;
  if (!stats?.totalMembers) return null;

  if (teamScope === TEAM_SCOPES.MINE && rowId === coachId) {
    return stats;
  }

  if (teamScope === TEAM_SCOPES.MINE) {
    return null;
  }

  return stats;
}
