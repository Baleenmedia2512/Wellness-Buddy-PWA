/**
 * Resolve Activity Report audience by team scope (mine / direct / full).
 * Uses reportingHierarchyService — same rules as Ideal Weight & Testimonials reports.
 */
import { getSupabaseClient } from '../../../utils/supabaseClient.js';
import {
  loadReportingContext,
  getDirectReportingMembers,
  getFullReportingMembers,
} from '../../../utils/reportingHierarchyService.js';
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
 * Member counts for Mine / Direct / Full tabs.
 *
 * @param {number} userId
 * @param {string} role
 * @returns {Promise<{ mine: number, direct: number, full: number, hasTeam: boolean }>}
 */
export async function getTeamScopeCounts(userId, role) {
  if (role === 'member') {
    return { mine: 1, direct: 0, full: 0, hasTeam: false };
  }

  if (role === 'admin' || role === 'developer') {
    const all = await repo.fetchAllActiveMembers();
    const supabase = getSupabaseClient();
    const context = await loadReportingContext(supabase);
    const direct = getDirectReportingMembers(userId, context);
    return {
      mine: 1,
      direct: direct.length,
      full: all.length,
      hasTeam: direct.length > 0 || all.length > 0,
    };
  }

  const supabase = getSupabaseClient();
  const context = await loadReportingContext(supabase);
  const direct = getDirectReportingMembers(userId, context);
  const full = getFullReportingMembers(userId, context);
  return {
    mine: 1,
    direct: direct.length,
    full: full.length,
    hasTeam: direct.length > 0 || full.length > 0,
  };
}

/**
 * User IDs whose activity rows belong in the report for the selected scope.
 *
 * @param {{ userId: number, role: string, teamScope?: string }} params
 * @returns {Promise<{ userIds: number[], teamScope: string, teamScopeCounts: object }>}
 */
export async function resolveActivityReportUserIds({ userId, role, teamScope }) {
  const teamScopeCounts = await getTeamScopeCounts(userId, role);
  let scope = normalizeTeamScope(teamScope);

  if (role === 'member' || !teamScopeCounts.hasTeam) {
    scope = TEAM_SCOPES.MINE;
  }

  if (scope === TEAM_SCOPES.MINE) {
    return { userIds: [userId], teamScope: scope, teamScopeCounts };
  }

  if (role === 'admin' || role === 'developer') {
    if (scope === TEAM_SCOPES.DIRECT) {
      const supabase = getSupabaseClient();
      const context = await loadReportingContext(supabase);
      const direct = getDirectReportingMembers(userId, context);
      return {
        userIds: direct.map((m) => m.UserId).filter(Boolean),
        teamScope: scope,
        teamScopeCounts,
      };
    }
    const all = await repo.fetchAllActiveMembers();
    return {
      userIds: all.map((m) => m.UserId).filter(Boolean),
      teamScope: scope,
      teamScopeCounts,
    };
  }

  const supabase = getSupabaseClient();
  const context = await loadReportingContext(supabase);
  const members = scope === TEAM_SCOPES.DIRECT
    ? getDirectReportingMembers(userId, context)
    : getFullReportingMembers(userId, context);

  return {
    userIds: members.map((m) => m.UserId).filter(Boolean),
    teamScope: scope,
    teamScopeCounts,
  };
}
