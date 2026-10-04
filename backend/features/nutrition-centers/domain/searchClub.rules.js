/**
 * Club shown on Diary user search.
 * A person uses their own club. When they have none, the direct coach's club is used.
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

export function resolveSearchClubName({ userId, coachId } = {}, clubByOwner) {
  const lookup = (id) => {
    const key = ownerKey(id);
    if (key == null || !clubByOwner) return '';
    return String(clubByOwner.get(key) || '').trim();
  };
  return lookup(userId) || lookup(coachId) || null;
}
