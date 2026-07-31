/**
 * Activity Report team scope — dual-coaching hierarchy including Active + Inactive members.
 * Mirrors getDualCoachingTeamHierarchy level rules without Status filtering.
 */
import { getSupabaseClient } from '../../../utils/supabaseClient.js';
import { loadReportingContext } from '../../../utils/reportingHierarchyService.js';

/**
 * @param {import('../../../utils/reportingHierarchyService.js').ReportingContext} context
 * @param {number} userIdNum
 * @param {{ CoachTeamId?: string|null }} userRow
 * @returns {Promise<number[]>}
 */
async function resolveCoachPartnerIds(context, userIdNum, userRow) {
  let partnerIds = [userIdNum];

  if (!userRow?.CoachTeamId) return partnerIds;

  const supabase = getSupabaseClient();
  const { data: coachTeam } = await supabase
    .from('coach_teams_table')
    .select('CoachId, CoCoachId')
    .eq('TeamId', userRow.CoachTeamId)
    .eq('Status', 'active')
    .maybeSingle();

  if (coachTeam?.CoachId && coachTeam?.CoCoachId) {
    partnerIds = [coachTeam.CoachId, coachTeam.CoCoachId];
  }

  return partnerIds;
}

/**
 * Walk the coach downline (all statuses) using the same level rules as dual-coaching hierarchy.
 *
 * @param {number} userId
 * @returns {Promise<{ directIds: number[], fullIds: number[] }>}
 */
export async function buildActivityReportCoachScope(userId) {
  const supabase = getSupabaseClient();
  const userIdNum = Number(userId);
  const context = await loadReportingContext(supabase);
  const user = context.userById.get(userIdNum);

  if (!user) {
    return { directIds: [], fullIds: [] };
  }

  const partnerIds = await resolveCoachPartnerIds(context, userIdNum, user);
  const coCoachPeerId = partnerIds.length > 1
    ? partnerIds.find((id) => id !== userIdNum)
    : null;

  /** @type {Array<{ UserId: number, HierarchyLevel: number, IsCoCoach: boolean, IsLoggedInCoach: boolean }>} */
  const hierarchy = [];
  const processed = new Set([userIdNum]);

  if (coCoachPeerId && context.userById.has(coCoachPeerId)) {
    hierarchy.push({
      UserId: coCoachPeerId,
      HierarchyLevel: 1,
      IsCoCoach: true,
      IsLoggedInCoach: false,
    });
    processed.add(coCoachPeerId);
  }

  let currentCoachIds = [...partnerIds];
  let level = 1;
  const maxLevel = 10;

  while (currentCoachIds.length > 0 && level <= maxLevel) {
    /** @type {import('../../../utils/reportingHierarchyService.js').TeamUser[]} */
    const levelMembers = [];

    for (const coachId of currentCoachIds) {
      for (const child of context.dbChildrenByCoachId.get(coachId) || []) {
        if (processed.has(child.UserId)) continue;
        if (partnerIds.includes(child.UserId) && child.UserId !== userIdNum) continue;
        processed.add(child.UserId);
        levelMembers.push(child);
      }
    }

    if (levelMembers.length === 0) break;

    const nextCoachIds = [];
    for (const member of levelMembers) {
      hierarchy.push({
        UserId: member.UserId,
        HierarchyLevel: level,
        IsCoCoach: false,
        IsLoggedInCoach: false,
      });
      nextCoachIds.push(member.UserId);
    }

    currentCoachIds = nextCoachIds;
    level += 1;
  }

  const isDownline = (m) => (
    Number(m.UserId) !== userIdNum && !m.IsCoCoach && !m.IsLoggedInCoach
  );

  return {
    directIds: hierarchy
      .filter((m) => m.HierarchyLevel === 1 && isDownline(m))
      .map((m) => m.UserId)
      .filter(Boolean),
    fullIds: hierarchy
      .filter(isDownline)
      .map((m) => m.UserId)
      .filter(Boolean),
  };
}

/**
 * Admin/developer scope — all team_table rows (Active + Inactive).
 *
 * @param {number} userId
 * @returns {Promise<{ directIds: number[], fullIds: number[] }>}
 */
export async function buildActivityReportAdminScope(userId) {
  const supabase = getSupabaseClient();
  const userIdNum = Number(userId);
  const context = await loadReportingContext(supabase);

  const directIds = (context.dbChildrenByCoachId.get(userIdNum) || [])
    .map((m) => m.UserId)
    .filter(Boolean);

  const fullIds = context.allUsers
    .map((m) => m.UserId)
    .filter((id) => id !== userIdNum);

  return { directIds, fullIds };
}
