/**
 * backend/utils/sponsorCoachResolution.js
 *
 * Sponsor = direct team_table.CoachId parent.
 * Ideal-Weight Coach = nearest ancestor on the CoachId chain (starting at the
 * sponsor) whose latest weight is inside BMI 19–23 (computeIdealWeightRange).
 *
 * ADR-0007. Does not reimplement hierarchyHelpers tree aggregation.
 *
 * Performance:
 * - Ancestor height/weight are loaded in bulk via `.in(UserId, …)` — never per ancestor.
 * - Ideal-range weight is the latest row by CreatedAt (not max(Weight)).
 * - List resolution walks CoachId chains in BFS batches (not one query per hop × sponsor).
 */

import { getSupabaseClient } from './supabaseClient.js';
import { computeIdealWeightRange } from './weightValidation.js';

const MAX_CHAIN_DEPTH = 10;

/**
 * @param {number|string|null|undefined} heightCm
 * @param {number|string|null|undefined} weightKg
 * @returns {boolean}
 */
export function isWeightInIdealRange(heightCm, weightKg) {
  const range = computeIdealWeightRange(heightCm);
  const w = parseFloat(weightKg);
  if (!range || !Number.isFinite(w) || w <= 0) return false;
  return w >= range.idealMin && w <= range.idealMax;
}

/**
 * From weight rows already ordered by CreatedAt DESC, keep the first (latest)
 * valid kg per user. Does not use max(Weight).
 *
 * @param {Array<{ UserId?: string|number, userId?: string|number, Weight?: number|string|null, weight?: number|string|null }>} rows
 * @returns {Map<string, number|null>}
 */
export function pickLatestWeightKgByCreatedAt(rows) {
  const map = new Map();
  for (const w of rows || []) {
    const id = w.UserId != null ? String(w.UserId) : (w.userId != null ? String(w.userId) : null);
    if (!id || map.has(id)) continue;
    const raw = w.Weight != null ? w.Weight : w.weight;
    const kg = raw != null ? parseFloat(raw) : null;
    if (Number.isFinite(kg) && kg > 0) map.set(id, kg);
    else map.set(id, null); // latest row exists but unusable — do not fall back to older max
  }
  return map;
}

/**
 * Walk ancestor profiles from sponsor upward; first in ideal range wins.
 *
 * @param {Array<{ userId: string, userName?: string|null, heightCm?: number|null, weightKg?: number|null }>} ancestors
 * @returns {{ idealCoachId: string|null, idealCoachName: string|null }}
 */
export function pickIdealCoachFromProfiles(ancestors) {
  if (!Array.isArray(ancestors) || ancestors.length === 0) {
    return { idealCoachId: null, idealCoachName: null };
  }
  for (const node of ancestors) {
    if (!node?.userId) continue;
    if (!isWeightInIdealRange(node.heightCm, node.weightKg)) continue;
    const name = node.userName != null ? String(node.userName).trim() : '';
    return {
      idealCoachId: String(node.userId),
      idealCoachName: name || null,
    };
  }
  return { idealCoachId: null, idealCoachName: null };
}

/**
 * Batch-walk CoachId chains for many starting sponsors.
 * Each BFS depth level uses one `.in(UserId, frontier)` query (max MAX_CHAIN_DEPTH rounds).
 *
 * @param {string[]} startUserIds
 * @param {object} [supabase]
 * @returns {Promise<Map<string, string[]>>} startId → ordered chain (inclusive)
 */
export async function walkCoachIdChainsBatched(startUserIds, supabase = getSupabaseClient()) {
  const starts = [...new Set((startUserIds || []).map((id) => String(id)).filter(Boolean))];
  const result = new Map();
  if (starts.length === 0) return result;

  const parentOf = new Map();
  let frontier = [...starts];
  let depth = 0;

  while (frontier.length > 0 && depth < MAX_CHAIN_DEPTH) {
    const need = frontier.filter((id) => !parentOf.has(id));
    if (need.length === 0) break;

    const { data, error } = await supabase
      .from('team_table')
      .select('"UserId", "CoachId"')
      .in('UserId', need);
    if (error) throw error;

    const found = new Set();
    for (const row of data || []) {
      const id = row.UserId != null ? String(row.UserId) : null;
      if (!id) continue;
      found.add(id);
      parentOf.set(id, row.CoachId != null ? String(row.CoachId) : null);
    }
    for (const id of need) {
      if (!found.has(id)) parentOf.set(id, null);
    }

    const nextFrontier = [];
    for (const id of need) {
      const parent = parentOf.get(id);
      if (!parent || parent === id) continue;
      if (!parentOf.has(parent)) nextFrontier.push(parent);
    }
    frontier = [...new Set(nextFrontier)];
    depth += 1;
  }

  for (const start of starts) {
    const chain = [];
    let current = start;
    let hops = 0;
    while (current && hops < MAX_CHAIN_DEPTH) {
      chain.push(current);
      const parent = parentOf.has(current) ? parentOf.get(current) : null;
      if (!parent || parent === current || chain.includes(parent)) break;
      current = parent;
      hops += 1;
    }
    result.set(start, chain);
  }

  return result;
}

/**
 * Walk CoachId upward from startUserId (inclusive). Cycle-safe, depth-capped.
 * Prefer walkCoachIdChainsBatched when resolving many sponsors.
 *
 * @param {string} startUserId
 * @param {object} [supabase]
 * @returns {Promise<string[]>}
 */
export async function walkCoachIdChain(startUserId, supabase = getSupabaseClient()) {
  const batched = await walkCoachIdChainsBatched(
    startUserId != null ? [String(startUserId)] : [],
    supabase,
  );
  return batched.get(String(startUserId)) || [];
}

/**
 * Load UserName, Height, and latest Weight for many user IDs in two queries.
 * Weight = first row after CreatedAt DESC per user (not max Weight).
 *
 * @param {string[]} userIds
 * @param {object} [supabase]
 * @returns {Promise<Map<string, { userId: string, userName: string|null, heightCm: number|null, weightKg: number|null }>>}
 */
export async function loadAncestorProfiles(userIds, supabase = getSupabaseClient()) {
  const map = new Map();
  const ids = [...new Set((userIds || []).map((id) => String(id)).filter(Boolean))];
  if (ids.length === 0) return map;

  const { data: rows, error } = await supabase
    .from('team_table')
    .select('"UserId", "UserName", "Height"')
    .in('UserId', ids);
  if (error) throw error;

  for (const row of rows || []) {
    const id = row.UserId != null ? String(row.UserId) : null;
    if (!id) continue;
    const height = row.Height != null ? parseFloat(row.Height) : null;
    map.set(id, {
      userId: id,
      userName: row.UserName != null ? String(row.UserName).trim() : null,
      heightCm: Number.isFinite(height) ? height : null,
      weightKg: null,
    });
  }

  // One batched query — CreatedAt DESC so first sighting per user is latest record.
  const { data: weights, error: wErr } = await supabase
    .from('weight_records_table')
    .select('"UserId", "Weight", "CreatedAt"')
    .in('UserId', ids)
    .or('"IsDeleted".is.null,"IsDeleted".eq.false,"IsDeleted".eq.0')
    .order('"CreatedAt"', { ascending: false });
  if (wErr) throw wErr;

  const latestByUser = pickLatestWeightKgByCreatedAt(weights);
  for (const [id, kg] of latestByUser.entries()) {
    const profile = map.get(id);
    if (!profile) continue;
    profile.weightKg = kg;
  }

  return map;
}

/**
 * Resolve sponsor + ideal-weight coach for one member.
 *
 * @param {string|number} memberUserId
 * @param {{ supabase?: object }} [opts]
 */
export async function resolveSponsorAndIdealCoach(memberUserId, opts = {}) {
  const supabase = opts.supabase || getSupabaseClient();
  const empty = {
    sponsorId: null,
    sponsorName: null,
    idealCoachId: null,
    idealCoachName: null,
  };
  if (memberUserId == null || memberUserId === '') return empty;

  const { data: member, error } = await supabase
    .from('team_table')
    .select('"CoachId"')
    .eq('"UserId"', String(memberUserId))
    .limit(1)
    .maybeSingle();
  if (error) throw error;

  const sponsorId = member?.CoachId != null ? String(member.CoachId) : null;
  if (!sponsorId) return empty;

  const chainIds = await walkCoachIdChain(sponsorId, supabase);
  const profiles = await loadAncestorProfiles(chainIds, supabase);
  const ordered = chainIds.map((id) => profiles.get(id) || {
    userId: id, userName: null, heightCm: null, weightKg: null,
  });
  const sponsorProfile = ordered[0] || null;
  const ideal = pickIdealCoachFromProfiles(ordered);

  return {
    sponsorId,
    sponsorName: sponsorProfile?.userName || null,
    idealCoachId: ideal.idealCoachId,
    idealCoachName: ideal.idealCoachName,
  };
}

/**
 * Batch resolve for many members. Ideal coach is cached per unique sponsor.
 * Chain walks + ancestor metrics are batched (no per-ancestor metric queries).
 *
 * @param {Array<{ userId: string|number, coachId?: string|number|null }>} members
 * @param {{ supabase?: object }} [opts]
 */
export async function resolveSponsorAndIdealCoachForMembers(members, opts = {}) {
  const supabase = opts.supabase || getSupabaseClient();
  const result = new Map();
  const list = Array.isArray(members) ? members : [];
  if (list.length === 0) return result;

  const needCoachLookup = [];
  const memberSponsor = new Map();

  for (const m of list) {
    const mid = m?.userId != null ? String(m.userId) : null;
    if (!mid) continue;
    if (m.coachId !== undefined) {
      memberSponsor.set(mid, m.coachId != null ? String(m.coachId) : null);
    } else {
      needCoachLookup.push(mid);
    }
  }

  if (needCoachLookup.length > 0) {
    const { data, error } = await supabase
      .from('team_table')
      .select('"UserId", "CoachId"')
      .in('UserId', needCoachLookup);
    if (error) throw error;
    for (const row of data || []) {
      const mid = row.UserId != null ? String(row.UserId) : null;
      if (!mid) continue;
      memberSponsor.set(mid, row.CoachId != null ? String(row.CoachId) : null);
    }
  }

  const uniqueSponsors = [...new Set([...memberSponsor.values()].filter(Boolean))];
  const sponsorIdealCache = new Map();

  const chainsBySponsor = await walkCoachIdChainsBatched(uniqueSponsors, supabase);
  const allChainIds = new Set();
  for (const chain of chainsBySponsor.values()) {
    chain.forEach((id) => allChainIds.add(id));
  }

  const profiles = await loadAncestorProfiles([...allChainIds], supabase);

  for (const sid of uniqueSponsors) {
    const chain = chainsBySponsor.get(sid) || [sid];
    const ordered = chain.map((id) => profiles.get(id) || {
      userId: id, userName: null, heightCm: null, weightKg: null,
    });
    const sponsorProfile = ordered[0] || null;
    const ideal = pickIdealCoachFromProfiles(ordered);
    sponsorIdealCache.set(sid, {
      sponsorId: sid,
      sponsorName: sponsorProfile?.userName || null,
      idealCoachId: ideal.idealCoachId,
      idealCoachName: ideal.idealCoachName,
    });
  }

  for (const [mid, sid] of memberSponsor.entries()) {
    if (!sid) {
      result.set(mid, {
        sponsorId: null,
        sponsorName: null,
        idealCoachId: null,
        idealCoachName: null,
      });
      continue;
    }
    result.set(mid, sponsorIdealCache.get(sid) || {
      sponsorId: sid,
      sponsorName: null,
      idealCoachId: null,
      idealCoachName: null,
    });
  }

  return result;
}
