/**
 * reports.repository.js — Data layer for the Reports feature.
 * Owns: team_table (direct-downline lookup) + weight_records_table (latest weight).
 */
import { getSupabaseClient } from '../../utils/supabaseClient.js';
import {
  loadReportingContext,
  getFullReportingMembers,
  getDirectReportingMembers,
  buildReportingChildrenIndex,
} from '../../utils/reportingHierarchyService.js';

/**
 * Walk the reporting hierarchy and derive parent links plus direct-to-root flags.
 */
function extractReportingHierarchyMeta(context, rootCoachId) {
  const rootId = Number(rootCoachId);
  const parentByUserId = new Map();
  const childrenByParentId = buildReportingChildrenIndex(context, rootId);
  const directToRoot = new Set(getDirectReportingMembers(rootId, context).map((m) => m.UserId));

  for (const [parentId, childIds] of childrenByParentId) {
    for (const childId of childIds) {
      parentByUserId.set(Number(childId), Number(parentId));
    }
  }

  return { parentByUserId, childrenByParentId, directToRoot };
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
 * Fetch every descendant in the coach hierarchy (excludes the coach).
 * Uses indexed subtree load — same member set as getFullTeamMembers without full-table scan.
 *
 * @param {number} coachId
 * @returns {Promise<{
 *   rawMembers: Array<{ UserId: number, UserName: string, Height: string|null, CoachId: number, HierarchyParent: number, isDirectToRoot: boolean }>,
 *   childrenByParentId: Map<number, number[]>
 * }>}
 */
export async function getFullTeamMembersIndexed(coachId) {
  const supabase = getSupabaseClient();
  const context = await loadReportingContextForCoach(supabase, coachId);
  const reportingMembers = getFullReportingMembers(coachId, context);
  const { parentByUserId, childrenByParentId, directToRoot } = extractReportingHierarchyMeta(
    context,
    coachId,
  );

  if (reportingMembers.length === 0) {
    return { rawMembers: [], childrenByParentId };
  }

  const rawMembers = reportingMembers
    .filter((member) => member.UserId !== coachId)
    .map((member) => ({
      UserId: member.UserId,
      UserName: member.UserName,
      Height: member.Height ?? null,
      CoachId: member.CoachId,
      Role: member.Role,
      Status: member.Status,
      HierarchyParent: parentByUserId.get(Number(member.UserId)) ?? member.CoachId,
      isDirectToRoot: directToRoot.has(Number(member.UserId)),
    }))
    .sort((a, b) => String(a.UserName || '').localeCompare(String(b.UserName || '')));

  return { rawMembers, childrenByParentId };
}

/**
 * Fetch every Active descendant in the coach hierarchy (excludes the coach).
 *
 * @param {number} coachId
 * @returns {Promise<{
 *   rawMembers: Array<{ UserId: number, UserName: string, Height: string|null, CoachId: number, HierarchyParent: number, isDirectToRoot: boolean }>,
 *   childrenByParentId: Map<number, number[]>
 * }>}
 */
export async function getFullTeamMembers(coachId) {
  const supabase = getSupabaseClient();
  const context = await loadReportingContext(supabase);
  const reportingMembers = getFullReportingMembers(coachId, context);
  const { parentByUserId, childrenByParentId, directToRoot } = extractReportingHierarchyMeta(
    context,
    coachId,
  );

  const memberIds = reportingMembers
    .map((m) => m.UserId)
    .filter((id) => id !== coachId);
  if (memberIds.length === 0) {
    return { rawMembers: [], childrenByParentId };
  }

  const rawMembers = reportingMembers
    .filter((member) => member.UserId !== coachId)
    .map((member) => ({
      UserId: member.UserId,
      UserName: member.UserName,
      Height: member.Height ?? null,
      CoachId: member.CoachId,
      Role: member.Role,
      Status: member.Status,
      HierarchyParent: parentByUserId.get(Number(member.UserId)) ?? member.CoachId,
      isDirectToRoot: directToRoot.has(Number(member.UserId)),
    }))
    .sort((a, b) => String(a.UserName || '').localeCompare(String(b.UserName || '')));

  return { rawMembers, childrenByParentId };
}

/**
 * Fetch direct-downline members for a given coach using reporting hierarchy rules.
 *
 * @param {number} coachId
 * @returns {Promise<Array<{ UserId: number, UserName: string, Height: string|null }>>}
 */
export async function getDirectDownline(coachId) {
  const supabase = getSupabaseClient();
  const context = await loadReportingContext(supabase);
  return getDirectReportingMembers(coachId, context)
    .filter((member) => member.UserId !== coachId)
    .map((member) => ({
      UserId: member.UserId,
      UserName: member.UserName,
      Height: member.Height ?? null,
    }))
    .sort((a, b) => String(a.UserName || '').localeCompare(String(b.UserName || '')));
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
