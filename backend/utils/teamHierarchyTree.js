/**
 * Primary CoachId hierarchy helpers for Leadership Dashboard / team-hierarchy.
 *
 * Three relationships must stay separate:
 * 1. Downline  — recursive CoachId only
 * 2. Peer      — same direct CoachId (sibling nodes; not used to build this tree)
 * 3. Co-Coach  — coach_teams Sponsor/Co-Sponsor partners.
 *    Tree edges stay CoachId-only. The viewer's own partner is merged at the
 *    root. Diary search also lists each already-visible coach's partner and
 *    that partner's CoachId teammates (see collectDownlinePartnerSearchIds).
 *
 * Never treat CoCoachId / derived co-coach as a recursive parent edge.
 */

/**
 * @param {Array<{ CoachId?: number|null, CoCoachId?: number|null, coachId?: number|null, coCoachId?: number|null }>} teams
 * @returns {Map<number, number>} leadUserId → partnerUserId
 */
export function buildLeadPartnerByUserId(teams = []) {
  const map = new Map();
  for (const team of teams || []) {
    const a = Number(team?.CoachId ?? team?.coachId);
    const b = Number(team?.CoCoachId ?? team?.coCoachId);
    if (!Number.isFinite(a) || a <= 0 || !Number.isFinite(b) || b <= 0) continue;
    if (a === b) continue;
    map.set(a, b);
    map.set(b, a);
  }
  return map;
}

/**
 * True when `user` is a primary CoachId direct report of `parentId`.
 * Co-coach partners of the parent are never treated as children.
 *
 * @param {{ UserId?: number, userId?: number, CoachId?: number|null, coachId?: number|null }} user
 * @param {number|string} parentId
 * @param {Map<number, number>} [leadPartnerByUserId]
 * @returns {boolean}
 */
export function isPrimaryDirectReport(user, parentId, leadPartnerByUserId = new Map()) {
  const parent = Number(parentId);
  const uid = Number(user?.UserId ?? user?.userId);
  const coachId = Number(user?.CoachId ?? user?.coachId);
  if (!Number.isFinite(parent) || parent <= 0) return false;
  if (!Number.isFinite(uid) || uid <= 0) return false;
  if (!Number.isFinite(coachId) || coachId <= 0) return false;
  if (uid === parent) return false;
  if (coachId !== parent) return false;

  const partner = leadPartnerByUserId.get(parent);
  if (partner != null && uid === Number(partner)) return false;

  return true;
}

/**
 * @param {Array<object>} allUsers
 * @param {number|string} parentId
 * @param {Map<number, number>} [leadPartnerByUserId]
 * @param {Set<number>} [excludeIds]
 * @returns {object[]}
 */
export function listPrimaryDirectReports(
  allUsers,
  parentId,
  leadPartnerByUserId = new Map(),
  excludeIds = new Set(),
) {
  const excluded = excludeIds instanceof Set ? excludeIds : new Set(excludeIds || []);
  return (allUsers || []).filter((user) => {
    const uid = Number(user?.UserId ?? user?.userId);
    if (excluded.has(uid)) return false;
    return isPrimaryDirectReport(user, parentId, leadPartnerByUserId);
  });
}

/**
 * Collect every UserId under `rootId` via CoachId only (BFS).
 * Excludes the root. Skips co-coach partners of each walked node.
 *
 * @param {Array<object>} allUsers
 * @param {number|string} rootId
 * @param {Map<number, number>} [leadPartnerByUserId]
 * @returns {number[]}
 */
export function collectPrimaryDownlineIds(
  allUsers,
  rootId,
  leadPartnerByUserId = new Map(),
) {
  const root = Number(rootId);
  if (!Number.isFinite(root) || root <= 0) return [];

  const result = [];
  const visited = new Set([root]);
  let frontier = [root];

  while (frontier.length > 0) {
    const next = [];
    for (const parentId of frontier) {
      const children = listPrimaryDirectReports(
        allUsers,
        parentId,
        leadPartnerByUserId,
        visited,
      );
      for (const child of children) {
        const uid = Number(child.UserId ?? child.userId);
        if (!Number.isFinite(uid) || visited.has(uid)) continue;
        visited.add(uid);
        result.push(uid);
        next.push(uid);
      }
    }
    frontier = next;
  }

  return result;
}

/**
 * Shared-team visibility IDs for a Sponsor/Co-Sponsor viewer:
 * own CoachId downline ∪ partner CoachId downline (deduped). Partner node itself
 * is not included (partners are metadata, not downline).
 *
 * @param {Array<object>} allUsers
 * @param {number|string} viewerId
 * @param {number|string|null|undefined} partnerId
 * @param {Map<number, number>} [leadPartnerByUserId]
 * @returns {number[]}
 */
export function collectSharedTeamMemberIds(
  allUsers,
  viewerId,
  partnerId = null,
  leadPartnerByUserId = new Map(),
) {
  const own = collectPrimaryDownlineIds(allUsers, viewerId, leadPartnerByUserId);
  const partner = partnerId != null && Number(partnerId) !== Number(viewerId)
    ? collectPrimaryDownlineIds(allUsers, partnerId, leadPartnerByUserId)
    : [];

  const seen = new Set();
  const merged = [];
  for (const id of [...own, ...partner]) {
    const n = Number(id);
    if (!Number.isFinite(n) || seen.has(n)) continue;
    seen.add(n);
    merged.push(n);
  }
  return merged;
}

/**
 * Extra people for Diary / team search.
 *
 * `visibleIds` is the viewer plus everyone already on the CoachId tree
 * (including the viewer's own co-coach merge). For each of those people,
 * also include their Sponsor/Co-Sponsor partner and that partner's CoachId
 * downline (teammates and their CoachId descendants).
 *
 * Does not reparent anyone. Does not open a second partnership hop: a
 * teammate's own co-coach is included only when they already sit in the
 * partner's CoachId tree.
 *
 * Callers decide active/inactive filtering.
 *
 * @param {Array<object>} allUsers
 * @param {Iterable<number|string>} visibleIds
 * @param {Map<number, number>} [leadPartnerByUserId]
 * @returns {{ ids: number[], partnerIds: number[] }}
 */
export function collectDownlinePartnerSearchIds(
  allUsers,
  visibleIds,
  leadPartnerByUserId = new Map(),
) {
  const visible = new Set();
  for (const raw of visibleIds || []) {
    const id = Number(raw);
    if (Number.isFinite(id) && id > 0) visible.add(id);
  }

  const seenPairs = new Set();
  const extra = [];
  const extraSet = new Set();
  const partnerIds = [];
  const partnerSet = new Set();

  const add = (raw) => {
    const id = Number(raw);
    if (!Number.isFinite(id) || id <= 0) return;
    if (visible.has(id) || extraSet.has(id)) return;
    extraSet.add(id);
    extra.push(id);
  };

  for (const id of visible) {
    const partner = Number(leadPartnerByUserId.get(id));
    if (!Number.isFinite(partner) || partner <= 0 || partner === id) continue;
    const pairKey = id < partner ? `${id}:${partner}` : `${partner}:${id}`;
    if (seenPairs.has(pairKey)) continue;
    seenPairs.add(pairKey);

    if (!partnerSet.has(partner)) {
      partnerSet.add(partner);
      partnerIds.push(partner);
    }
    add(partner);
    for (const teammateId of collectPrimaryDownlineIds(allUsers, partner, leadPartnerByUserId)) {
      add(teammateId);
    }
  }

  return { ids: extra, partnerIds };
}
