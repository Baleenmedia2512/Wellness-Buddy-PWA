/**
 * Resolve Activity Report audience by team scope (mine / direct / full).
 *
 * Direct and Full include all team members (Active + Inactive).
 * Co-coach peer is excluded from Direct/Full counts.
 */
import {
  buildActivityReportAdminScope,
  buildActivityReportCoachScope,
} from './activity-report.hierarchy.js';

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

function buildTeamScopeCounts(directIds, fullIds) {
  return {
    mine: 1,
    direct: directIds.length,
    full: fullIds.length,
    hasTeam: directIds.length > 0 || fullIds.length > 0,
  };
}

/**
 * Coach/upline: dual-coaching hierarchy (level 1 = direct, all downline = full).
 */
async function resolveCoachScope(userId) {
  const { directIds, fullIds } = await buildActivityReportCoachScope(userId);
  return {
    directIds,
    fullIds,
    teamScopeCounts: buildTeamScopeCounts(directIds, fullIds),
  };
}

/**
 * Admin/developer: all team_table members (Active + Inactive).
 */
async function resolveAdminScope(userId) {
  const { directIds, fullIds } = await buildActivityReportAdminScope(userId);
  return {
    directIds,
    fullIds,
    teamScopeCounts: buildTeamScopeCounts(directIds, fullIds),
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

  const resolved = (role === 'admin' || role === 'developer')
    ? await resolveAdminScope(userId)
    : await resolveCoachScope(userId);

  const { directIds, fullIds, teamScopeCounts } = resolved;

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
