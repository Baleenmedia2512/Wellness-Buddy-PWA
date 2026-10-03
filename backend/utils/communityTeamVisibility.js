/**
 * Community-level Team visibility (same Community ID / team code).
 *
 * Community ID ≠ Coach / Co-Coach relationship.
 * Independent coaches who share a community code can see each other's
 * Direct / Full Team downlines without becoming parent-child or co-coach.
 *
 * Tree edges remain CoachId-only. This module only selects peer coach roots
 * whose downlines should be unioned for Team visibility.
 */

/**
 * @param {unknown} value
 * @returns {string|null}
 */
export function normalizeCommunityTeamCode(value) {
  if (value == null || String(value).trim() === '') return null;
  return String(value).trim().toUpperCase();
}

/**
 * Shared community / team code for a user row.
 * Prefer CommunityId, then CoachTeamId, then TeamId.
 *
 * @param {{ CommunityId?: unknown, CoachTeamId?: unknown, TeamId?: unknown, communityId?: unknown, coachTeamId?: unknown, teamId?: unknown }} user
 * @returns {string|null}
 */
export function getUserCommunityTeamCode(user) {
  if (!user) return null;
  return normalizeCommunityTeamCode(
    user.CommunityId
      ?? user.communityId
      ?? user.CoachTeamId
      ?? user.coachTeamId
      ?? user.TeamId
      ?? user.teamId,
  );
}

/**
 * @param {number} ancestorId
 * @param {number} descendantId
 * @param {Map<number, { CoachId?: number|null, coachId?: number|null }>} userById
 * @returns {boolean}
 */
export function isCoachIdAncestorOf(ancestorId, descendantId, userById) {
  const ancestor = Number(ancestorId);
  const descendant = Number(descendantId);
  if (!Number.isFinite(ancestor) || !Number.isFinite(descendant)) return false;
  if (ancestor === descendant) return false;
  if (!(userById instanceof Map)) return false;

  let walkId = Number(
    userById.get(descendant)?.CoachId
      ?? userById.get(descendant)?.coachId,
  );
  const visited = new Set([descendant]);
  while (Number.isFinite(walkId) && !visited.has(walkId)) {
    if (walkId === ancestor) return true;
    visited.add(walkId);
    const row = userById.get(walkId);
    walkId = Number(row?.CoachId ?? row?.coachId);
  }
  return false;
}

/**
 * @param {Array<object>} allUsers
 * @returns {{ userById: Map<number, object>, childrenByCoachId: Map<number, object[]> }}
 */
function buildUserIndexes(allUsers) {
  const userById = new Map();
  const childrenByCoachId = new Map();
  for (const user of allUsers || []) {
    const id = Number(user?.UserId ?? user?.userId);
    if (!Number.isFinite(id)) continue;
    userById.set(id, user);
    const parentId = Number(user?.CoachId ?? user?.coachId);
    if (!Number.isFinite(parentId)) continue;
    if (!childrenByCoachId.has(parentId)) childrenByCoachId.set(parentId, []);
    childrenByCoachId.get(parentId).push(user);
  }
  return { userById, childrenByCoachId };
}

/**
 * Independent coaches who share the viewer's Community ID / team code.
 *
 * A peer must:
 * - share the same normalized community/team code
 * - have their own CoachId downline
 * - not be the viewer's Sponsor/Co-Sponsor partner (handled separately)
 * - not sit under the viewer (or vice versa) via CoachId
 * - not sit under another same-community coach candidate
 *   (so nested coaches like A under Yasheer are not treated as peer roots)
 *
 * Does not write or infer CoachId / CoCoachId.
 *
 * @param {number|string} viewerId
 * @param {Array<object>} allUsers
 * @param {{ partnerIds?: Array<number|string> }} [options]
 * @returns {number[]}
 */
export function resolveCommunityPeerCoachIds(viewerId, allUsers, { partnerIds = [] } = {}) {
  const rootId = Number(viewerId);
  if (!Number.isFinite(rootId) || rootId <= 0) return [];

  const { userById, childrenByCoachId } = buildUserIndexes(allUsers);
  const viewer = userById.get(rootId);
  if (!viewer) return [];

  const communityCode = getUserCommunityTeamCode(viewer);
  if (!communityCode) return [];

  const partnerSet = new Set(
    (Array.isArray(partnerIds) ? partnerIds : [])
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id) && id !== rootId),
  );

  /** @type {number[]} */
  const candidates = [];
  for (const user of allUsers || []) {
    const id = Number(user?.UserId ?? user?.userId);
    if (!Number.isFinite(id) || id === rootId) continue;
    if (getUserCommunityTeamCode(user) !== communityCode) continue;

    const children = childrenByCoachId.get(id) || [];
    if (children.length === 0) continue;

    // Keep real hierarchy: never treat an upline/downline as a community peer root.
    if (isCoachIdAncestorOf(rootId, id, userById)) continue;
    if (isCoachIdAncestorOf(id, rootId, userById)) continue;

    candidates.push(id);
  }

  // Include Sponsor/Co-Sponsor partners in candidate ancestry so their nested
  // coaches (L under Balaji) are not promoted to peer roots, then drop partners
  // from the final list (they are handled by partnerRootIds).
  return candidates
    .filter((id) => (
      !candidates.some((other) => other !== id && isCoachIdAncestorOf(other, id, userById))
    ))
    .filter((id) => !partnerSet.has(id));
}
