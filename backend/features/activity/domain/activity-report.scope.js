/**
 * Resolve Activity Report audience by team scope (mine / direct / full).
 *
 * Active downline via indexed reporting hierarchy (matches Ideal Weight / Reports).
 * Sponsor / Co-Sponsor leads keep Mine/Direct/Full UI even with 0 own members
 * (shared-team partner roster may still populate).
 */
import { getSupabaseClient } from '../../../utils/supabaseClient.js';
import { resolveLeadSeatForUser } from '../../../utils/coachTeamSeats.js';
import { buildActivityReportCoachScope } from './activity-report.hierarchy.js';

export const TEAM_SCOPES = Object.freeze({
  MINE: 'mine',
  DIRECT: 'direct',
  FULL: 'full',
});

/**
 * @param {string} teamScope
 * @returns {string}
 */
export function normalizeTeamScope(teamScope) {
  const scope = String(teamScope || TEAM_SCOPES.FULL).toLowerCase();
  if (scope === TEAM_SCOPES.MINE || scope === TEAM_SCOPES.DIRECT || scope === TEAM_SCOPES.FULL) {
    return scope;
  }
  return TEAM_SCOPES.FULL;
}

function buildTeamScopeCounts(directIds, fullIds, { isSharedLead = false } = {}) {
  const hasRoster = directIds.length > 0 || fullIds.length > 0;
  return {
    mine: 1,
    direct: directIds.length,
    full: fullIds.length,
    hasTeam: hasRoster || isSharedLead,
  };
}

/**
 * Coach / upline / admin — same dual-coaching tree (Active downline only).
 */
async function resolveTeamScope(userId) {
  const supabase = getSupabaseClient();
  const [{ directIds, fullIds }, seat] = await Promise.all([
    buildActivityReportCoachScope(userId),
    resolveLeadSeatForUser(supabase, userId),
  ]);
  const isSharedLead = seat.seat === 'sponsor' || seat.seat === 'co-sponsor';
  return {
    directIds,
    fullIds,
    teamScopeCounts: buildTeamScopeCounts(directIds, fullIds, { isSharedLead }),
  };
}

/**
 * User IDs whose activity rows belong in the report for the selected scope.
 *
 * @param {{ userId: number, role: string, teamScope?: string }} params
 * @returns {Promise<{ userIds: number[], teamScope: string, teamScopeCounts: object }>}
 */
export async function resolveActivityReportUserIds({ userId, role, teamScope }) {
  let scope = normalizeTeamScope(teamScope);

  if (role === 'member') {
    return {
      userIds: [userId],
      teamScope: TEAM_SCOPES.MINE,
      teamScopeCounts: { mine: 1, direct: 0, full: 0, hasTeam: false },
    };
  }

  const { directIds, fullIds, teamScopeCounts } = await resolveTeamScope(userId);

  if (!teamScopeCounts.hasTeam) {
    scope = TEAM_SCOPES.MINE;
  }

  if (scope === TEAM_SCOPES.MINE) {
    return { userIds: [userId], teamScope: scope, teamScopeCounts };
  }

  if (scope === TEAM_SCOPES.DIRECT) {
    return { userIds: directIds, teamScope: scope, teamScopeCounts };
  }

  return { userIds: fullIds, teamScope: scope, teamScopeCounts };
}
