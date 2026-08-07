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

/** Supabase `.in()` URL length safety — batch user id lookups. */
const WEIGHT_USER_ID_CHUNK = 150;

/**
 * Walk the reporting hierarchy and derive parent links plus direct-to-root flags.
 */
function extractReportingHierarchyMeta(context, rootCoachId) {
  const rootId = Number(rootCoachId);
  const parentByUserId = new Map();
  const childrenByParentId = buildReportingChildrenIndex(context, rootId);
  const directToRoot = new Set(getDirectReportingMembers(rootId, context).map((m) => m.UserId));

  for (const [parentId, childIds] of childrenByParentId) {
    for (const childId of childIds) {
      parentByUserId.set(Number(childId), Number(parentId));
    }
  }

  return { parentByUserId, childrenByParentId, directToRoot };
}

function mapReportingMembersToRaw(reportingMembers, coachId, parentByUserId, directToRoot) {
  return reportingMembers
    .filter((member) => member.UserId !== coachId)
    .map((member) => ({
      UserId: member.UserId,
      UserName: member.UserName,
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
    .select('"UserId", "UserName", "Height", "CoachId", "Role", "Status"')
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
  const reportingMembers = getFullReportingMembers(coachId, context);
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
  const reportingMembers = getFullReportingMembers(coachId, context);
  const { parentByUserId, childrenByParentId, directToRoot } = extractReportingHierarchyMeta(
    context,
    coachId,
  );

  const memberIds = reportingMembers
    .map((m) => m.UserId)
    .filter((id) => id !== coachId);
  if (memberIds.length === 0) {
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
 * Merge chunked weight rows into Map keyed by UserId with latest + previous.
 * Rows must be ordered CreatedAt DESC; first = today/latest, second = previous.
 *
 * @param {Array<{ UserId: number, Weight: number|null, CreatedAt?: string }>|null|undefined} rows
 * @param {Map<number, { todayWeight: number|null, previousWeight: number|null, lastUpdated: string|null }>} map
 */
function mergeLatestTwoWeightRows(rows, map) {
  for (const row of rows || []) {
    const uid = row.UserId;
    const weight =
      row.Weight !== null && row.Weight !== undefined ? parseFloat(row.Weight) : null;
    const parsed = Number.isFinite(weight) ? weight : null;
    const existing = map.get(uid);
    if (!existing) {
      map.set(uid, {
        todayWeight: parsed,
        previousWeight: null,
        lastUpdated: row.CreatedAt ?? null,
      });
      continue;
    }
    if (existing.previousWeight == null && parsed != null) {
      existing.previousWeight = parsed;
    }
  }
}

/**
 * Fetch latest + previous weight for each userId (single batched query path).
 * Returns Map<userId, { todayWeight, previousWeight, lastUpdated }>.
 *
 * @param {number[]} userIds
 * @returns {Promise<Map<number, { todayWeight: number|null, previousWeight: number|null, lastUpdated: string|null }>>}
 */
export async function getLatestTwoWeightsForUsers(userIds) {
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
    mergeLatestTwoWeightRows(rows, map);
  }
  return map;
}

/**
 * Batch-fetch today's persisted wellness scores for many users.
 * Filters by score_date only (no historical rows). Ordered for tie-breaks:
 * percentage DESC, computed_at DESC.
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
        .in('user_id', chunk)
        .order('percentage', { ascending: false })
        .order('computed_at', { ascending: false });
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
