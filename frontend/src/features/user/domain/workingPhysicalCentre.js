/**
 * Working Physical Centre shown on Profile.
 * Own clubs first. Otherwise the nearest upline who owns a club.
 * Several clubs for that person: latest registration (else highest id) is selected.
 */

function ownerKey(id) {
  const n = Number(id);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function clubsByOwner(centers) {
  const byOwner = new Map();
  for (const center of centers || []) {
    const ownerId = ownerKey(center?.owner_user_id);
    const name = String(center?.center_name || '').trim();
    const id = Number(center?.id);
    if (ownerId == null || !name || !Number.isFinite(id) || id <= 0) continue;
    const at = Date.parse(center?.registered_at || '') || 0;
    const list = byOwner.get(ownerId) || [];
    list.push({ id, name, at });
    byOwner.set(ownerId, list);
  }
  return byOwner;
}

/**
 * @param {number|string} userId
 * @param {Array<{ id?: number, center_name?: string, owner_user_id?: number, registered_at?: string }>} centers
 * @param {Array<number|string>} coachChain user first, then each upline
 * @returns {{ id: number|null, name: string|null, options: Array<{ id: number, name: string }> }}
 */
export function resolveWorkingPhysicalCentreFromChain(userId, centers, coachChain) {
  const byOwner = clubsByOwner(centers);
  const seen = new Set();
  const chain = [];
  for (const id of [userId, ...(coachChain || [])]) {
    const key = ownerKey(id);
    if (key == null || seen.has(key)) continue;
    seen.add(key);
    chain.push(key);
  }
  for (const ownerId of chain) {
    const owned = byOwner.get(ownerId);
    if (!owned?.length) continue;
    owned.sort((a, b) => b.at - a.at || b.id - a.id);
    return {
      id: owned[0].id,
      name: owned[0].name,
      options: owned.map(({ id, name }) => ({ id, name })),
    };
  }
  return { id: null, name: null, options: [] };
}
