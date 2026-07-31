/**
 * Activity Report team scope — dual-coaching hierarchy including Active + Inactive members.
 * Uses indexed CoachId lookups per level (no full team_table scan).
 */
import { getSupabaseClient } from '../../../utils/supabaseClient.js';

const MEMBER_SELECT = 'UserId, UserName, CoachId, CoachTeamId, Status, Role';

/**
 * @param {number} userIdNum
 * @param {{ CoachTeamId?: string|null, TeamId?: string|null }} userRow
 * @returns {Promise<number[]>}
 */
async function resolveCoachPartnerIds(supabase, userIdNum, userRow) {
  let partnerIds = [userIdNum];
  const teamId = userRow?.TeamId ?? userRow?.CoachTeamId;
  if (!teamId) return partnerIds;

  const { data: coachTeam } = await supabase
    .from('coach_teams_table')
    .select('CoachId, CoCoachId')
    .eq('TeamId', teamId)
    .eq('Status', 'active')
    .maybeSingle();

  if (coachTeam?.CoachId && coachTeam?.CoCoachId) {
    partnerIds = [coachTeam.CoachId, coachTeam.CoCoachId];
  }

  return partnerIds;
}

/**
 * Walk the coach downline (all statuses) using dual-coaching level rules.
 *
 * @param {number} userId
 * @returns {Promise<{ directIds: number[], fullIds: number[] }>}
 */
export async function buildActivityReportCoachScope(userId) {
  const supabase = getSupabaseClient();
  const userIdNum = Number(userId);

  const { data: user, error: userError } = await supabase
    .from('team_table')
    .select(MEMBER_SELECT)
    .eq('UserId', userIdNum)
    .maybeSingle();

  if (userError) throw userError;
  if (!user) return { directIds: [], fullIds: [] };

  const partnerIds = await resolveCoachPartnerIds(supabase, userIdNum, user);
  const coCoachPeerId = partnerIds.length > 1
    ? partnerIds.find((id) => id !== userIdNum)
    : null;

  /** @type {Array<{ UserId: number, HierarchyLevel: number, IsCoCoach: boolean }>} */
  const hierarchy = [];
  const processed = new Set([userIdNum]);

  if (coCoachPeerId) {
    const { data: partner } = await supabase
      .from('team_table')
      .select(MEMBER_SELECT)
      .eq('UserId', coCoachPeerId)
      .maybeSingle();

    if (partner) {
      hierarchy.push({ UserId: partner.UserId, HierarchyLevel: 1, IsCoCoach: true });
      processed.add(partner.UserId);
    }
  }

  let currentCoachIds = [...partnerIds];
  let level = 1;
  const maxLevel = 10;

  while (currentCoachIds.length > 0 && level <= maxLevel) {
    const { data: levelMembers, error: levelError } = await supabase
      .from('team_table')
      .select(MEMBER_SELECT)
      .in('CoachId', currentCoachIds);

    if (levelError) throw levelError;
    if (!levelMembers?.length) break;

    const nextCoachIds = [];

    for (const member of levelMembers) {
      if (processed.has(member.UserId)) continue;
      if (partnerIds.includes(member.UserId) && member.UserId !== userIdNum) continue;

      processed.add(member.UserId);
      hierarchy.push({
        UserId: member.UserId,
        HierarchyLevel: level,
        IsCoCoach: false,
      });
      nextCoachIds.push(member.UserId);
    }

    if (nextCoachIds.length === 0) break;
    currentCoachIds = nextCoachIds;
    level += 1;
  }

  const isDownline = (m) => Number(m.UserId) !== userIdNum && !m.IsCoCoach;

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
 * Admin/developer scope — indexed lookups only (no full-table context load).
 *
 * @param {number} userId
 * @returns {Promise<{ directIds: number[], fullIds: number[] }>}
 */
export async function buildActivityReportAdminScope(userId) {
  const supabase = getSupabaseClient();
  const userIdNum = Number(userId);

  const [directResult, fullResult] = await Promise.all([
    supabase
      .from('team_table')
      .select('UserId')
      .eq('CoachId', userIdNum),
    supabase
      .from('team_table')
      .select('UserId')
      .in('Status', ['Active', 'Inactive']),
  ]);

  if (directResult.error) throw directResult.error;
  if (fullResult.error) throw fullResult.error;

  const directIds = (directResult.data || []).map((row) => row.UserId).filter(Boolean);
  const fullIds = (fullResult.data || [])
    .map((row) => row.UserId)
    .filter((id) => id !== userIdNum);

  return { directIds, fullIds };
}
