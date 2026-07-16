/**
 * Reporting Hierarchy Service
 * ─────────────────────────────────────────────────────────────────────────────
 * Resolves which team members appear on Result & Reports dashboards based on
 * coach active/inactive status. Reused by testimonials, reports, and upload stats.
 *
 * Business rules:
 * - Active coach → direct list = own DB downline; active child coaches manage their teams.
 * - Inactive coach → shown in parent's direct list; their active members roll up to parent.
 * - Full scope → direct members + full subtree under each active child coach.
 */
import { isActiveTeamStatus } from './teamHierarchyBuilder.js';

const COACH_ROLES = new Set(['coach', 'admin']);

/** @param {string|undefined} role */
export function isCoachRole(role) {
  return COACH_ROLES.has(String(role || '').toLowerCase());
}

/**
 * @typedef {object} TeamUser
 * @property {number} UserId
 * @property {string} UserName
 * @property {string} [Email]
 * @property {string} [Role]
 * @property {number|null} [CoachId]
 * @property {string} [Status]
 * @property {string|null} [ProfileImage]
 * @property {string|null} [PhoneNumber]
 * @property {string|null} [Height]
 * @property {string|null} [CoachTeamId]
 */

/**
 * @typedef {object} ReportingContext
 * @property {TeamUser[]} allUsers
 * @property {Map<number, TeamUser>} userById
 * @property {Map<number, TeamUser[]>} dbChildrenByCoachId
 */

/**
 * Build an in-memory reporting context from pre-loaded team rows.
 * @param {TeamUser[]} allUsers
 * @returns {ReportingContext}
 */
export function buildReportingContext(allUsers) {
  const userById = new Map();
  const dbChildrenByCoachId = new Map();

  for (const user of allUsers || []) {
    userById.set(user.UserId, user);
    const parentId = Number(user.CoachId);
    if (!Number.isFinite(parentId)) continue;
    if (!dbChildrenByCoachId.has(parentId)) dbChildrenByCoachId.set(parentId, []);
    dbChildrenByCoachId.get(parentId).push(user);
  }

  return { allUsers: allUsers || [], userById, dbChildrenByCoachId };
}

/**
 * Load all team users once for a request (Active + Inactive).
 * @param {object} supabase
 * @returns {Promise<ReportingContext>}
 */
export async function loadReportingContext(supabase) {
  const { data: allUsers, error } = await supabase
    .from('team_table')
    .select('UserId, UserName, Email, Role, CoachId, CoachTeamId, Status, ProfileImage, PhoneNumber, Height')
    .order('UserName');

  if (error) throw new Error('Failed to fetch team data: ' + error.message);
  return buildReportingContext(allUsers || []);
}

/**
 * Walk up CoachId chain to the nearest active coach.
 * @param {number|null|undefined} startCoachId
 * @param {Map<number, TeamUser>} userById
 * @returns {TeamUser|null}
 */
export function findNearestActiveParentCoach(startCoachId, userById) {
  let currentId = Number(startCoachId);
  const visited = new Set();

  while (Number.isFinite(currentId) && !visited.has(currentId)) {
    visited.add(currentId);
    const user = userById.get(currentId);
    if (!user) return null;
    if (isCoachRole(user.Role) && isActiveTeamStatus(user.Status)) return user;
    currentId = Number(user.CoachId);
  }

  return null;
}

/**
 * Resolve the coach whose direct reporting list should be used.
 * Inactive viewing coaches fall back to their nearest active parent.
 * @param {number} coachId
 * @param {ReportingContext} context
 * @returns {number|null}
 */
export function resolveEffectiveCoachId(coachId, context) {
  const coach = context.userById.get(coachId);
  if (!coach) return null;

  if (isCoachRole(coach.Role) && !isActiveTeamStatus(coach.Status)) {
    const activeParent = findNearestActiveParentCoach(coach.CoachId, context.userById);
    return activeParent?.UserId ?? null;
  }

  return coachId;
}

/**
 * Collect active members rolled up from under an inactive coach subtree.
 * @param {number} inactiveCoachId
 * @param {ReportingContext} context
 * @param {Set<number>} [visited]
 * @returns {TeamUser[]}
 */
export function collectRolledUpDescendants(inactiveCoachId, context, visited = new Set()) {
  if (visited.has(inactiveCoachId)) return [];
  visited.add(inactiveCoachId);

  const children = context.dbChildrenByCoachId.get(inactiveCoachId) || [];
  const result = [];

  for (const child of children) {
    const childIsCoach = isCoachRole(child.Role);
    const childIsActive = isActiveTeamStatus(child.Status);

    if (childIsCoach && childIsActive) {
      result.push(child);
    } else if (childIsCoach && !childIsActive) {
      result.push(child);
      result.push(...collectRolledUpDescendants(child.UserId, context, visited));
    } else if (childIsActive) {
      result.push(child);
    }
  }

  return dedupeUsers(result);
}

/**
 * Full subtree under an active coach (DB downline), applying inactive-coach rollup.
 * @param {number} coachUserId
 * @param {ReportingContext} context
 * @returns {TeamUser[]}
 */
export function collectFullSubtreeUnderActiveCoach(coachUserId, context) {
  const result = new Map();
  const visited = new Set([coachUserId]);
  const queue = [...(context.dbChildrenByCoachId.get(coachUserId) || [])];

  while (queue.length > 0) {
    const child = queue.shift();
    if (visited.has(child.UserId)) continue;
    visited.add(child.UserId);

    const childIsCoach = isCoachRole(child.Role);
    const childIsActive = isActiveTeamStatus(child.Status);

    if (childIsCoach && !childIsActive) {
      result.set(child.UserId, child);
      for (const rolled of collectRolledUpDescendants(child.UserId, context)) {
        result.set(rolled.UserId, rolled);
      }
      continue;
    }

    if (!childIsActive) continue;

    result.set(child.UserId, child);

    if (childIsCoach && childIsActive) {
      for (const deeper of collectFullSubtreeUnderActiveCoach(child.UserId, context)) {
        result.set(deeper.UserId, deeper);
      }
    }
  }

  return [...result.values()];
}

/**
 * Direct reporting members for a coach (excludes the coach themselves).
 * @param {number} coachId
 * @param {ReportingContext} context
 * @returns {TeamUser[]}
 */
export function getDirectReportingMembers(coachId, context) {
  const effectiveCoachId = resolveEffectiveCoachId(coachId, context);
  if (!Number.isFinite(effectiveCoachId)) return [];

  const directDbChildren = context.dbChildrenByCoachId.get(effectiveCoachId) || [];
  const result = new Map();

  for (const child of directDbChildren) {
    if (child.UserId === effectiveCoachId) continue;

    const childIsCoach = isCoachRole(child.Role);
    const childIsActive = isActiveTeamStatus(child.Status);

    if (childIsCoach && childIsActive) {
      result.set(child.UserId, child);
    } else if (childIsCoach && !childIsActive) {
      result.set(child.UserId, child);
      for (const rolled of collectRolledUpDescendants(child.UserId, context)) {
        result.set(rolled.UserId, rolled);
      }
    } else if (childIsActive) {
      result.set(child.UserId, child);
    }
  }

  return [...result.values()];
}

/**
 * Full reporting members for a coach (excludes the coach themselves).
 * @param {number} coachId
 * @param {ReportingContext} context
 * @returns {TeamUser[]}
 */
export function getFullReportingMembers(coachId, context) {
  const direct = getDirectReportingMembers(coachId, context);
  const result = new Map(direct.map((member) => [member.UserId, member]));

  for (const member of direct) {
    if (isCoachRole(member.Role) && isActiveTeamStatus(member.Status)) {
      for (const subtreeMember of collectFullSubtreeUnderActiveCoach(member.UserId, context)) {
        result.set(subtreeMember.UserId, subtreeMember);
      }
    }
  }

  return [...result.values()];
}

/**
 * Return reporting members for a coach.
 * @param {number} coachId
 * @param {'direct'|'full'} scope
 * @param {ReportingContext} context
 * @returns {TeamUser[]}
 */
export function getReportingMembers(coachId, scope, context) {
  const id = Number(coachId);
  if (!Number.isFinite(id)) return [];
  return scope === 'full'
    ? getFullReportingMembers(id, context)
    : getDirectReportingMembers(id, context);
}

/**
 * User IDs for reporting scope (coach excluded).
 * @param {number} coachId
 * @param {'direct'|'full'} scope
 * @param {ReportingContext} context
 * @returns {number[]}
 */
export function getReportingMemberIds(coachId, scope, context) {
  return getReportingMembers(coachId, scope, context)
    .map((member) => member.UserId)
    .filter((id) => id !== Number(coachId));
}

/**
 * parentCoachId → direct reporting child userIds (active-coach branches only).
 * Used for per-coach team compliance / upload percentage rollups.
 * @param {ReportingContext} context
 * @param {number} rootCoachId
 * @returns {Map<number, number[]>}
 */
export function buildReportingChildrenIndex(context, rootCoachId) {
  const index = new Map();
  const visited = new Set();
  const queue = [Number(rootCoachId)];

  while (queue.length > 0) {
    const coachId = queue.shift();
    if (!Number.isFinite(coachId) || visited.has(coachId)) continue;
    visited.add(coachId);

    const children = getDirectReportingMembers(coachId, context);
    index.set(coachId, children.map((member) => member.UserId));

    for (const child of children) {
      if (isCoachRole(child.Role) && isActiveTeamStatus(child.Status)) {
        queue.push(child.UserId);
      }
    }
  }

  return index;
}

/**
 * Convenience: load context + return reporting members in one call.
 * @param {object} supabase
 * @param {number} coachId
 * @param {'direct'|'full'} [scope='direct']
 * @returns {Promise<TeamUser[]>}
 */
export async function fetchReportingMembers(supabase, coachId, scope = 'direct') {
  const context = await loadReportingContext(supabase);
  return getReportingMembers(coachId, scope, context);
}

/** @param {TeamUser[]} users */
function dedupeUsers(users) {
  const seen = new Map();
  for (const user of users) {
    if (!seen.has(user.UserId)) seen.set(user.UserId, user);
  }
  return [...seen.values()];
}
