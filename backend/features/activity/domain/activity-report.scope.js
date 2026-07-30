/**
 * Resolve Activity Report audience by team scope (mine / direct / full).
 *
 * Direct and Full always include Active members only.
 * Uses targeted queries — never loadReportingContext (full team_table scan times out).
 */
import { getDualCoachingTeamHierarchy } from '../../../utils/disciplineCalculationsSupabase.js';
import { isActiveTeamStatus } from '../../../utils/teamHierarchyBuilder.js';
import * as repo from '../activity-report.repository.js';

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

/**
 * Coach/upline: dual-coaching hierarchy (level 1 = direct, all downline = full).
 * Only Active status; co-coach peer is excluded from Direct/Full counts.
 */
async function resolveCoachScope(userId) {
  const hierarchy = await getDualCoachingTeamHierarchy(userId, false);
  const isActiveDownline = (m) => (
    Number(m.UserId) !== Number(userId)
    && isActiveTeamStatus(m.Status)
    && !m.IsCoCoach
    && !m.IsLoggedInCoach
  );

  const directIds = hierarchy
    .filter((m) => m.HierarchyLevel === 1 && isActiveDownline(m))
    .map((m) => m.UserId)
    .filter(Boolean);
  const fullIds = hierarchy
    .filter(isActiveDownline)
    .map((m) => m.UserId)
    .filter(Boolean);

  return {
    directIds,
    fullIds,
    teamScopeCounts: {
      mine: 1,
      direct: directIds.length,
      full: fullIds.length,
      hasTeam: directIds.length > 0 || fullIds.length > 0,
    },
  };
}

/**
 * Admin/developer: indexed direct lookup + active-member list for full scope.
 * Both paths query team_table with Status = Active only.
 */
async function resolveAdminScope(userId) {
  const [allMembers, directIds] = await Promise.all([
    repo.fetchAllActiveMembers(),
    repo.fetchDirectMemberIds(userId),
  ]);
  const fullIds = allMembers.map((m) => m.UserId).filter(Boolean);

  return {
    directIds,
    fullIds,
    teamScopeCounts: {
      mine: 1,
      direct: directIds.length,
      full: fullIds.length,
      hasTeam: directIds.length > 0 || fullIds.length > 0,
    },
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
