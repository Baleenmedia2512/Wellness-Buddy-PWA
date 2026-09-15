/**
 * Activity Report team scope — same rules as Ideal Weight (reportingHierarchyService).
 *
 * Level: Direct Team = 1, their members = 2, and so on (reporting tree, not profile role).
 * Person type: 0 CoachId downlines → customer (API token `member`); any downline → sponsor
 * (not profile Role). UI label for no-team people is Customer.
 */
import { getSupabaseClient } from '../../../utils/supabaseClient.js';
import {
  loadReportingContextForCoach,
} from '../../../utils/reportingHierarchyService.js';
import {
  getSharedTeamDirectMembers,
  getSharedTeamFullMembers,
} from '../../../utils/sharedTeamReporting.js';

/** In-process cache — warm lambda serves bootstrap + detail without re-walking tree. */
const scopeCache = new Map();
const SCOPE_TTL_MS = 60_000;

export const ACTIVITY_REPORT_MEMBER_TYPE = Object.freeze({
  MEMBER: 'member',
  SPONSOR: 'sponsor',
});

/**
 * @param {number} userId
 * @param {{ dbChildrenByCoachId?: Map<number, Array<{ UserId: number }>> }} context
 * @returns {'member'|'sponsor'}
 */
export function resolveActivityReportMemberType(userId, context) {
  const children = context?.dbChildrenByCoachId?.get(Number(userId)) || [];
  return children.length > 0
    ? ACTIVITY_REPORT_MEMBER_TYPE.SPONSOR
    : ACTIVITY_REPORT_MEMBER_TYPE.MEMBER;
}

/**
 * @param {number|string} userId
 * @param {{ levelByUserId?: Map<number, number>, memberTypeByUserId?: Map<number, string> }|null|undefined} memberMeta
 * @returns {{ level: number|null, memberType: 'member'|'sponsor' }}
 */
export function lookupActivityReportMemberMeta(userId, memberMeta) {
  const id = Number(userId);
  const levelMap = memberMeta?.levelByUserId;
  const typeMap = memberMeta?.memberTypeByUserId;
  const rawLevel = levelMap instanceof Map ? levelMap.get(id) : undefined;
  const rawType = typeMap instanceof Map ? typeMap.get(id) : undefined;
  const levelNum = Number(rawLevel);
  return {
    level: Number.isFinite(levelNum) ? levelNum : null,
    memberType: rawType === ACTIVITY_REPORT_MEMBER_TYPE.SPONSOR
      ? ACTIVITY_REPORT_MEMBER_TYPE.SPONSOR
      : ACTIVITY_REPORT_MEMBER_TYPE.MEMBER,
  };
}

/**
 * Viewer-only meta when the report does not load a team tree (plain member role).
 * @param {number} userId
 * @returns {{ levelByUserId: Map<number, number>, memberTypeByUserId: Map<number, string> }}
 */
export function selfActivityReportMemberMeta(userId) {
  const id = Number(userId);
  return {
    levelByUserId: new Map([[id, 0]]),
    memberTypeByUserId: new Map([[id, ACTIVITY_REPORT_MEMBER_TYPE.MEMBER]]),
  };
}

/**
 * Reporting-tree depth + downline-based member type for Activity Report rows.
 *
 * Direct Team members are always level 1 (including shared-team partners and
 * inactive-coach rollups). Nested full-team members increment from there.
 * Hidden rollup nodes (inactive nested leaders) are walked without a displayed
 * level so their visible children keep the reporting depth, not raw CoachId hops.
 *
 * @param {number} viewerId
 * @param {import('../../../utils/reportingHierarchyService.js').ReportingContext} context
 * @returns {{ levelByUserId: Map<number, number>, memberTypeByUserId: Map<number, string> }}
 */
export function buildActivityReportMemberMeta(viewerId, context) {
  const rootId = Number(viewerId);
  const levelByUserId = new Map();
  const memberTypeByUserId = new Map();

  if (!Number.isFinite(rootId) || !context) {
    return { levelByUserId, memberTypeByUserId };
  }

  levelByUserId.set(rootId, 0);
  memberTypeByUserId.set(rootId, resolveActivityReportMemberType(rootId, context));

  const directMembers = getSharedTeamDirectMembers(rootId, context);
  const fullMembers = getSharedTeamFullMembers(rootId, context);
  const fullIds = new Set(
    fullMembers
      .map((member) => Number(member.UserId))
      .filter((id) => Number.isFinite(id)),
  );

  for (const member of fullMembers) {
    const id = Number(member.UserId);
    if (!Number.isFinite(id)) continue;
    memberTypeByUserId.set(id, resolveActivityReportMemberType(id, context));
  }

  const visited = new Set([rootId]);
  const queue = [];

  for (const member of directMembers) {
    const id = Number(member.UserId);
    if (!Number.isFinite(id) || id === rootId || visited.has(id)) continue;
    visited.add(id);
    levelByUserId.set(id, 1);
    queue.push({ id, level: 1 });
  }

  while (queue.length > 0) {
    const { id, level } = queue.shift();
    const children = context.dbChildrenByCoachId?.get(id) || [];
    for (const child of children) {
      const childId = Number(child.UserId);
      if (!Number.isFinite(childId) || visited.has(childId)) continue;
      visited.add(childId);

      if (fullIds.has(childId)) {
        const nextLevel = level + 1;
        levelByUserId.set(childId, nextLevel);
        queue.push({ id: childId, level: nextLevel });
      } else {
        // Hidden rollup node — keep walking at the parent's reporting level.
        queue.push({ id: childId, level });
      }
    }
  }

  return { levelByUserId, memberTypeByUserId };
}

/**
 * @param {number} userId
 * @returns {Promise<{
 *   directIds: number[],
 *   fullIds: number[],
 *   memberMeta: { levelByUserId: Map<number, number>, memberTypeByUserId: Map<number, string> },
 * }>}
 */
export async function buildActivityReportCoachScope(userId) {
  const userIdNum = Number(userId);
  const key = String(userIdNum);
  const now = Date.now();
  const hit = scopeCache.get(key);
  if (hit && hit.expiresAt > now) return hit.value;

  const supabase = getSupabaseClient();
  const context = await loadReportingContextForCoach(supabase, userIdNum);
  const memberMeta = buildActivityReportMemberMeta(userIdNum, context);

  const value = {
    directIds: getSharedTeamDirectMembers(userIdNum, context)
      .map((member) => member.UserId)
      .filter(Boolean),
    fullIds: getSharedTeamFullMembers(userIdNum, context)
      .map((member) => member.UserId)
      .filter(Boolean),
    memberMeta,
  };

  scopeCache.set(key, { value, expiresAt: now + SCOPE_TTL_MS });
  return value;
}
