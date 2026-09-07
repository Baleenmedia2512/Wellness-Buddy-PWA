/**
 * reports.repository.js — Data layer for the Reports feature.
 * Owns: team_table (hierarchy lookup) + weight_records_table (latest weight).
 */
import { getSupabaseClient } from '../../utils/supabaseClient.js';
import logger from '../../shared/lib/logger.js';
import {
  loadReportingContext,
  loadReportingContextForCoach,
  getFullReportingMembers,
  getDirectReportingMembers,
  buildReportingChildrenIndex,
} from '../../utils/reportingHierarchyService.js';
import { shiftDateYmd, IANA_IST } from '../../shared/lib/datetime/index.js';
import { classifyWeightsForScoreDate } from './domain/wellness-score-report.weight.js';

/**
 * Batch-resolve UserName for many user ids (one query). Used for report Sponsor/Coach labels.
 * @param {Array<number|string>} userIds
 * @returns {Promise<Map<string, string|null>>}
 */
export async function getUserNamesByIds(userIds) {
  const map = new Map();
  const ids = [...new Set((userIds || [])
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id) && id > 0))];
  if (ids.length === 0) return map;

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('team_table')
    .select('"UserId", "UserName"')
    .in('"UserId"', ids);
  if (error) throw error;

  for (const row of data || []) {
    const id = row.UserId != null ? String(row.UserId) : null;
    if (!id) continue;
    const name = row.UserName != null ? String(row.UserName).trim() : '';
    map.set(id, name || null);
  }
  return map;
}

/** Supabase `.in()` URL length safety — batch user id lookups. */
const WEIGHT_USER_ID_CHUNK = 150;

/**
 * Partner lead ids (Sponsor ↔ Co-Sponsor) already resolved on the context.
 * @param {object} context
 * @param {number} rootCoachId
 * @returns {number[]}
 */
function getPartnerRootIds(context, rootCoachId) {
  const rootId = Number(rootCoachId);
  const partners = Array.isArray(context?.partnerRootIds) ? context.partnerRootIds : [];
  return partners
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id) && id !== rootId);
}

/**
 * Walk the reporting hierarchy and derive parent links plus direct-to-root flags.
 * When a Sponsor/Co-Sponsor partner exists, Direct includes both leads' direct
 * members (and the partner lead) so Ideal Weight Mine/Direct/Full match the
 * shared-team model.
 */
function extractReportingHierarchyMeta(context, rootCoachId) {
  const rootId = Number(rootCoachId);
  const partnerIds = getPartnerRootIds(context, rootId);
  const parentByUserId = new Map();
  const childrenByParentId = buildReportingChildrenIndex(context, rootId);
  const directToRoot = new Set(
    getDirectReportingMembers(rootId, context)
      .map((m) => Number(m.UserId))
      .filter((id) => id !== rootId),
  );

  for (const partnerId of partnerIds) {
    directToRoot.add(partnerId);
    for (const m of getDirectReportingMembers(partnerId, context)) {
      const id = Number(m.UserId);
      if (id !== rootId) directToRoot.add(id);
    }
    const partnerIndex = buildReportingChildrenIndex(context, partnerId);
    for (const [parentId, childIds] of partnerIndex) {
      if (!childrenByParentId.has(parentId)) {
        childrenByParentId.set(parentId, childIds);
      }
    }
  }

  for (const [parentId, childIds] of childrenByParentId) {
    for (const childId of childIds) {
      parentByUserId.set(Number(childId), Number(parentId));
    }
  }

  return { parentByUserId, childrenByParentId, directToRoot };
}

/**
 * Full reporting roster for Ideal Weight / Wellness Score reports.
 * Unions the viewer's tree with Sponsor/Co-Sponsor partner downline when linked.
 * @param {number} coachId
 * @param {object} context
 * @returns {import('../../utils/reportingHierarchyService.js').TeamUser[]}
 */
function collectReportTeamMembers(coachId, context) {
  const rootId = Number(coachId);
  const byId = new Map();

  for (const m of getFullReportingMembers(rootId, context)) {
    byId.set(Number(m.UserId), m);
  }

  for (const partnerId of getPartnerRootIds(context, rootId)) {
    const partner = context.userById?.get(partnerId);
    if (partner && Number(partner.UserId) !== rootId) {
      byId.set(Number(partner.UserId), partner);
    }
    for (const m of getFullReportingMembers(partnerId, context)) {
      const id = Number(m.UserId);
      if (id === rootId) continue;
      if (!byId.has(id)) byId.set(id, m);
    }
  }

  return [...byId.values()];
}

function mapReportingMembersToRaw(reportingMembers, coachId, parentByUserId, directToRoot) {
  return reportingMembers
    .filter((member) => member.UserId !== coachId)
    .map((member) => ({
      UserId: member.UserId,
      UserName: member.UserName,
      Email: member.Email || null,
      CommunityId: member.CommunityId ? String(member.CommunityId).trim() : null,
      Height: member.Height ?? null,
      CoachId: member.CoachId,
      Role: member.Role,
      Status: member.Status,
      HierarchyParent: parentByUserId.get(Number(member.UserId)) ?? member.CoachId,
      isDirectToRoot: directToRoot.has(Number(member.UserId)),
    }))
    .sort((a, b) => String(a.UserName || '').localeCompare(String(b.UserName || '')));
}

/**
 * Fetch the coach's own team_table row (for the "Mine" scope).
 *
 * @param {number} coachId
 * @returns {Promise<{ UserId: number, UserName: string, Height: string|null, CoachId?: number|null, Role?: string|null }|null>}
 */
export async function getCoachMember(coachId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('team_table')
    .select('"UserId", "UserName", "Email", "CommunityId", "Height", "CoachId", "Role", "Status"')
    .eq('"UserId"', coachId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

/**
 * Fetch every descendant in the coach hierarchy (excludes the coach).
 * Uses indexed subtree load — no full team_table scan (60s context cache).
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
  const reportingMembers = collectReportTeamMembers(coachId, context);
  const { parentByUserId, childrenByParentId, directToRoot } = extractReportingHierarchyMeta(
    context,
    coachId,
  );

  if (reportingMembers.length === 0) {
    return { rawMembers: [], childrenByParentId };
  }

  const rawMembers = mapReportingMembersToRaw(
    reportingMembers,
    coachId,
    parentByUserId,
    directToRoot,
  );

  return { rawMembers, childrenByParentId };
}

/**
 * Fetch every Active descendant in the coach hierarchy (excludes the coach).
 * Prefer indexed subtree load; fall back to full-context load only if indexed path fails.
 *
 * @param {number} coachId
 * @returns {Promise<{
 *   rawMembers: Array<{ UserId: number, UserName: string, Height: string|null, CoachId: number, HierarchyParent: number, isDirectToRoot: boolean }>,
 *   childrenByParentId: Map<number, number[]>
 * }>}
 */
export async function getFullTeamMembers(coachId) {
  try {
    return await getFullTeamMembersIndexed(coachId);
  } catch (indexedError) {
    // Indexed subtree load failed — fall through to legacy full-table context.
    logger.warn('[reports] indexed hierarchy load failed; using full team_table context', {
      coachId,
      message: indexedError?.message || String(indexedError),
    });
  }

  const supabase = getSupabaseClient();
  const context = await loadReportingContext(supabase);
  const reportingMembers = collectReportTeamMembers(coachId, context);
  const { parentByUserId, childrenByParentId, directToRoot } = extractReportingHierarchyMeta(
    context,
    coachId,
  );

  if (reportingMembers.length === 0) {
    return { rawMembers: [], childrenByParentId };
  }

  const rawMembers = mapReportingMembersToRaw(
    reportingMembers,
    coachId,
    parentByUserId,
    directToRoot,
  );

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
  const context = await loadReportingContextForCoach(supabase, coachId);
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
 * Merge chunked weight rows into a Map keyed by UserId (first = latest by CreatedAt DESC).
 * @param {Array<{ UserId: number, Weight: number|null, CreatedAt?: string }>|null|undefined} rows
 * @param {Map<number, { weight: number|null, lastUpdated: string|null }>} map
 */
function mergeLatestWeightRows(rows, map) {
  for (const row of rows || []) {
    if (map.has(row.UserId)) continue;
    map.set(row.UserId, {
      weight: row.Weight !== null && row.Weight !== undefined ? parseFloat(row.Weight) : null,
      lastUpdated: row.CreatedAt ?? null,
    });
  }
}

/**
 * Fetch the latest weight record for each userId in the supplied array.
 * Returns Map<userId, { weight, lastUpdated }>. Chunked + parallel to avoid URL limits.
 *
 * @param {number[]} userIds
 * @returns {Promise<Map<number, { weight: number|null, lastUpdated: string|null }>>}
 */
export async function getLatestWeightsForUsers(userIds) {
  const map = new Map();
  if (!userIds || userIds.length === 0) return map;

  const uniqueIds = [...new Set(userIds.filter((id) => Number.isFinite(Number(id))))];
  if (uniqueIds.length === 0) return map;

  const supabase = getSupabaseClient();
  const chunks = [];
  for (let i = 0; i < uniqueIds.length; i += WEIGHT_USER_ID_CHUNK) {
    chunks.push(uniqueIds.slice(i, i + WEIGHT_USER_ID_CHUNK));
  }

  const results = await Promise.all(
    chunks.map(async (chunk) => {
      const { data, error } = await supabase
        .from('weight_records_table')
        .select('"UserId", "Weight", "CreatedAt"')
        .in('"UserId"', chunk)
        .or('"IsDeleted".is.null,"IsDeleted".eq.false,"IsDeleted".eq.0')
        .order('"CreatedAt"', { ascending: false });
      if (error) throw error;
      return data || [];
    }),
  );

  for (const rows of results) {
    mergeLatestWeightRows(rows, map);
  }
  return map;
}

/**
 * Merge chunked weight rows into Map keyed by UserId.
 * When scoreDateYmd is set: todayWeight is the exact-day log only (else null);
 * previousWeight is the next-latest entry before that.
 * Without scoreDateYmd: first = latest, second = previous (legacy).
 *
 * @param {Array<{ UserId: number, Weight: number|null, CreatedAt?: string }>|null|undefined} rows
 * @param {Map<number, { todayWeight: number|null, previousWeight: number|null, lastUpdated: string|null }>} map
 * @param {string|null} [scoreDateYmd]
 */
function mergeLatestTwoWeightRows(rows, map, scoreDateYmd = null) {
  /** @type {Map<number, Array<{ UserId: number, Weight: number|null, CreatedAt?: string }>>} */
  const byUser = new Map();
  for (const row of rows || []) {
    const uid = row.UserId;
    if (uid == null) continue;
    const list = byUser.get(uid);
    if (list) list.push(row);
    else byUser.set(uid, [row]);
  }

  for (const [uid, userRows] of byUser.entries()) {
    map.set(uid, classifyWeightsForScoreDate(userRows, scoreDateYmd));
  }
}

/**
 * Fetch weight for each userId for the selected score date.
 * When `scoreDateYmd` is set:
 *   - todayWeight = weight logged ON that IST business day only (null → UI "—")
 *   - previousWeight = next-latest weight before that day's entry
 * When unset: latest two overall (legacy).
 *
 * For small page-sized sets, uses parallel per-user queries
 * (never downloads full weight history).
 *
 * @param {number[]} userIds
 * @param {string|null} [scoreDateYmd] YYYY-MM-DD IST business date
 * @returns {Promise<Map<number, { todayWeight: number|null, previousWeight: number|null, lastUpdated: string|null }>>}
 */
export async function getLatestTwoWeightsForUsers(userIds, scoreDateYmd = null) {
  const map = new Map();
  if (!userIds || userIds.length === 0) return map;

  const uniqueIds = [...new Set(userIds.filter((id) => Number.isFinite(Number(id))).map(Number))];
  if (uniqueIds.length === 0) return map;

  const asOf =
    typeof scoreDateYmd === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(scoreDateYmd)
      ? scoreDateYmd
      : null;
  // Legacy CreatedAt is IST wall-clock; exclusive next-day start keeps that day inclusive.
  const asOfExclusiveUpper = asOf ? `${shiftDateYmd(asOf, 1, IANA_IST)} 00:00:00` : null;
  // Fetch a few recent rows so same-day earlier logs can fill previousWeight.
  const perUserLimit = asOf ? 8 : 2;

  // Page-sized lookups: few rows/user only — avoids full history download.
  if (uniqueIds.length <= 40) {
    const supabase = getSupabaseClient();
    const results = await Promise.all(
      uniqueIds.map(async (uid) => {
        let query = supabase
          .from('weight_records_table')
          .select('"UserId", "Weight", "CreatedAt"')
          .eq('"UserId"', uid)
          .or('"IsDeleted".is.null,"IsDeleted".eq.false,"IsDeleted".eq.0');
        if (asOfExclusiveUpper) {
          query = query.lt('"CreatedAt"', asOfExclusiveUpper);
        }
        const { data, error } = await query
          .order('"CreatedAt"', { ascending: false })
          .limit(perUserLimit);
        if (error) throw error;
        return data || [];
      }),
    );
    for (const rows of results) {
      mergeLatestTwoWeightRows(rows, map, asOf);
    }
    return normalizeWeightMapKeys(map);
  }

  const supabase = getSupabaseClient();
  const chunks = [];
  for (let i = 0; i < uniqueIds.length; i += WEIGHT_USER_ID_CHUNK) {
    chunks.push(uniqueIds.slice(i, i + WEIGHT_USER_ID_CHUNK));
  }

  const results = await Promise.all(
    chunks.map(async (chunk) => {
      let query = supabase
        .from('weight_records_table')
        .select('"UserId", "Weight", "CreatedAt"')
        .in('"UserId"', chunk)
        .or('"IsDeleted".is.null,"IsDeleted".eq.false,"IsDeleted".eq.0');
      if (asOfExclusiveUpper) {
        query = query.lt('"CreatedAt"', asOfExclusiveUpper);
      }
      const { data, error } = await query.order('"CreatedAt"', { ascending: false });
      if (error) throw error;
      return data || [];
    }),
  );

  for (const rows of results) {
    mergeLatestTwoWeightRows(rows, map, asOf);
  }
  return normalizeWeightMapKeys(map);
}

function normalizeWeightMapKeys(map) {
  const normalized = new Map();
  for (const [key, value] of map.entries()) {
    const id = Number(key);
    if (!Number.isFinite(id)) continue;
    normalized.set(id, {
      todayWeight: value?.todayWeight ?? null,
      previousWeight: value?.previousWeight ?? null,
      lastUpdated: value?.lastUpdated ?? null,
    });
  }
  return normalized;
}

/**
 * Batch-fetch today's persisted wellness scores for many users.
 * Filters by score_date only (no historical rows). Ordered for tie-breaks:
 * total_earned DESC, computed_at DESC (matches displayed WELLNESS SCORE).
 *
 * @param {number[]} userIds
 * @param {string} scoreDate YYYY-MM-DD (IST business date ≈ CURRENT_DATE)
 * @returns {Promise<Map<number, { percentage: number, totalEarned: number, totalPossible: number, computedAt: string|null }>>}
 */
export async function getWellnessScoresForUsers(userIds, scoreDate) {
  const map = new Map();
  if (!userIds?.length || !scoreDate) return map;

  const uniqueIds = [...new Set(userIds.filter((id) => Number.isFinite(Number(id))))];
  if (uniqueIds.length === 0) return map;

  const supabase = getSupabaseClient();
  const chunks = [];
  for (let i = 0; i < uniqueIds.length; i += WEIGHT_USER_ID_CHUNK) {
    chunks.push(uniqueIds.slice(i, i + WEIGHT_USER_ID_CHUNK));
  }

  const results = await Promise.all(
    chunks.map(async (chunk) => {
      const { data, error } = await supabase
        .from('wellness_score_daily_table')
        .select('user_id, percentage, total_earned, total_possible, computed_at')
        .eq('score_date', scoreDate)
        .in('user_id', chunk);
      if (error) throw error;
      return data || [];
    }),
  );

  for (const rows of results) {
    for (const row of rows) {
      const uid = Number(row.user_id);
      if (!Number.isFinite(uid)) continue;
      map.set(uid, {
        percentage: Number(row.percentage) || 0,
        totalEarned: Number(row.total_earned) || 0,
        totalPossible: Number(row.total_possible) || 0,
        computedAt: row.computed_at ?? null,
      });
    }
  }
  return map;
}
