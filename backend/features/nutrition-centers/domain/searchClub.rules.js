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

function bestClubByOwner(centers) {
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
  return best;
}

export function primaryClubNameByOwner(centers) {
  const names = new Map();
  for (const [ownerId, row] of bestClubByOwner(centers)) names.set(ownerId, row.name);
  return names;
}

function clubsOwnedBy(centers, ownerId) {
  return (centers || [])
    .filter((center) => ownerKey(center?.owner_user_id) === ownerId)
    .map((center) => ({
      id: Number(center?.id) || 0,
      name: String(center?.center_name || '').trim(),
      at: Date.parse(center?.registered_at || '') || 0,
    }))
    .filter((center) => center.id > 0 && center.name)
    .sort((a, b) => b.at - a.at || b.id - a.id)
    .map(({ id, name }) => ({ id, name }));
}

/**
 * Profile "Working Physical Centre".
 * Own clubs when this person has any. Otherwise the nearest upline who has a club.
 * Several clubs for that person: latest registration is selected; all of theirs are options.
 * Nobody in the chain: empty options (UI shows None).
 * @param {number|string} userId
 * @param {Array<{ id?: number, center_name?: string, owner_user_id?: number, registered_at?: string }>} centers
 * @param {Map<number, number|null>} coachByUser
 * @returns {{ id: number|null, name: string|null, options: Array<{ id: number, name: string }> }}
 */
export function resolveWorkingPhysicalCentre(userId, centers, coachByUser) {
  const clubByOwner = primaryClubNameByOwner(centers);
  const seen = new Set();
  let current = ownerKey(userId);
  let ownerId = null;
  while (current != null && !seen.has(current)) {
    seen.add(current);
    if (String(clubByOwner.get(current) || '').trim()) {
      ownerId = current;
      break;
    }
    const parent = coachByUser ? coachByUser.get(current) : null;
    if (parent == null || parent === current) break;
    current = parent;
  }
  if (ownerId == null) return { id: null, name: null, options: [] };
  const options = clubsOwnedBy(centers, ownerId);
  const primary = bestClubByOwner(centers).get(ownerId);
  const selected = options.find((opt) => opt.id === primary?.id) || options[0] || null;
  return {
    id: selected?.id ?? null,
    name: selected?.name ?? null,
    options,
  };
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
