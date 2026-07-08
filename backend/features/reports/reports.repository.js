/**
 * reports.repository.js — Data layer for the Reports feature.
 * Owns: team_table (direct-downline lookup) + weight_records_table (latest weight).
 */
import { getSupabaseClient } from '../../utils/supabaseClient.js';

/**
 * Walk the hierarchy tree and derive each member's parent coach plus
 * which users are direct children of the logged-in coach.
 */
function extractHierarchyMeta(hierarchy, rootCoachId) {
  const rootId = Number(rootCoachId);
  const parentByUserId = new Map();
  const directToRoot = new Set();

  function walk(node) {
    if (!node?.teamMembers?.length) return;
    for (const child of node.teamMembers) {
      const childId = child.userId;
      const parentId = node.userId;
      if (childId != null && parentId != null) {
        parentByUserId.set(childId, parentId);
        if (Number(parentId) === rootId) directToRoot.add(childId);
      }
      walk(child);
    }
  }

  if (hierarchy) walk(hierarchy);
  return { parentByUserId, directToRoot };
}

/**
 * Fetch the coach's own team_table row (for the "Mine" scope).
 *
 * @param {number} coachId
 * @returns {Promise<{ UserId: number, UserName: string, Height: string|null }|null>}
 */
export async function getCoachMember(coachId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('team_table')
    .select('"UserId", "UserName", "Height"')
    .eq('"UserId"', coachId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

/**
 * Fetch every Active descendant in the coach hierarchy (excludes the coach).
 *
 * @param {number} coachId
 * @returns {Promise<Array<{ UserId: number, UserName: string, Height: string|null, CoachId: number }>>}
 */
export async function getFullTeamMembers(coachId) {
  const supabase = getSupabaseClient();
  const { buildTeamHierarchy } = await import('../../utils/teamHierarchyBuilder.js');
  const { allMembers, hierarchy } = await buildTeamHierarchy(supabase, coachId);
  const { parentByUserId, directToRoot } = extractHierarchyMeta(hierarchy, coachId);
  const memberIds = (allMembers || [])
    .map((m) => m.UserId)
    .filter((id) => id !== coachId);
  if (memberIds.length === 0) return [];

  const { data, error } = await supabase
    .from('team_table')
    .select('"UserId", "UserName", "Height", "CoachId"')
    .in('"UserId"', memberIds)
    .eq('"Status"', 'Active')
    .order('"UserName"', { ascending: true });
  if (error) throw error;

  return (data || []).map((member) => ({
    ...member,
    HierarchyParent: parentByUserId.get(member.UserId) ?? member.CoachId,
    isDirectToRoot: directToRoot.has(member.UserId),
  }));
}

/**
 * Fetch direct-downline members for a given coach.
 * Returns UserId, UserName, Height for every Active member whose CoachId matches.
 *
 * @param {number} coachId
 * @returns {Promise<Array<{ UserId: number, UserName: string, Height: string|null }>>}
 */
export async function getDirectDownline(coachId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('team_table')
    .select('"UserId", "UserName", "Height"')
    .eq('"CoachId"', coachId)
    .eq('"Status"', 'Active')
    .order('"UserName"', { ascending: true });
  if (error) throw error;
  return data || [];
}

/**
 * Fetch the latest weight record for each userId in the supplied array.
 * Returns a Map<userId, weightKg|null>.
 *
 * @param {number[]} userIds
 * @returns {Promise<Map<number, number|null>>}
 */
export async function getLatestWeightsForUsers(userIds) {
  if (!userIds || userIds.length === 0) return new Map();
  const supabase = getSupabaseClient();

  // Fetch all relevant rows ordered by CreatedAt desc; we take the first
  // occurrence per UserId when building the map.
  const { data, error } = await supabase
    .from('weight_records_table')
    .select('"UserId", "Weight"')
    .in('"UserId"', userIds)
    .or('"IsDeleted".is.null,"IsDeleted".eq.false,"IsDeleted".eq.0')
    .order('"CreatedAt"', { ascending: false });
  if (error) throw error;

  const map = new Map();
  for (const row of (data || [])) {
    if (!map.has(row.UserId)) {
      map.set(row.UserId, row.Weight !== null ? parseFloat(row.Weight) : null);
    }
  }
  return map;
}
