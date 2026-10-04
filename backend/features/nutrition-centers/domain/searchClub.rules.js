/**
 * Club shown on Diary user search.
 * A person uses their own club. When they have none, walk the coach chain
 * (coach, then that coach's upline) until a club is found.
 * Several clubs for one owner: the latest registration wins.
 */

function ownerKey(id) {
  const n = Number(id);
  return Number.isFinite(n) ? n : null;
}

export function primaryClubNameByOwner(centers) {
  const best = new Map();
  for (const center of centers || []) {
    const ownerId = ownerKey(center?.owner_user_id);
    const name = String(center?.center_name || '').trim();
    if (ownerId == null || !name) continue;
    const at = Date.parse(center?.registered_at || '') || 0;
    const id = Number(center?.id) || 0;
    const prev = best.get(ownerId);
    if (!prev || at > prev.at || (at === prev.at && id > prev.id)) {
      best.set(ownerId, { name, at, id });
    }
  }
  const names = new Map();
  for (const [ownerId, row] of best) names.set(ownerId, row.name);
  return names;
}

export function coachIdByUser(users) {
  const map = new Map();
  for (const user of users || []) {
    const id = ownerKey(user?.UserId ?? user?.userId);
    if (id == null) continue;
    map.set(id, ownerKey(user?.CoachId ?? user?.coachId));
  }
  return map;
}

/**
 * Own club, else the nearest upline club. Stops on a missing parent or a loop.
 * @param {number|string} userId
 * @param {Map<number, string>} clubByOwner
 * @param {Map<number, number|null>} coachByUser
 */
export function resolveSearchClubName(userId, clubByOwner, coachByUser) {
  const seen = new Set();
  let current = ownerKey(userId);
  while (current != null && !seen.has(current)) {
    seen.add(current);
    const club = clubByOwner ? String(clubByOwner.get(current) || '').trim() : '';
    if (club) return club;
    const parent = coachByUser ? coachByUser.get(current) : null;
    if (parent == null || parent === current) break;
    current = parent;
  }
  return null;
}
