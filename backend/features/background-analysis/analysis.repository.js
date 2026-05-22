import { getSupabaseClient, getISTTimestamp, convertToIST } from '../../utils/supabaseClient.js';

export async function insertAnalysis(payload) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('food_nutrition_data_table')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listAnalyses({ userId, limit, offset }) {
  const supabase = getSupabaseClient();
  const { data, error, count } = await supabase
    .from('food_nutrition_data_table')
    .select('*', { count: 'exact' })
    .eq('"UserID"', userId)
    .eq('"IsDeleted"', 0)
    // Exclude pending-capture rows that were pre-created for the instant-share
    // optimisation but never enriched with analysis data (e.g. because the
    // captured image turned out to be a weight scale or education screenshot,
    // not food).  Those rows have AnalysisData = NULL and would otherwise
    // render as "Unknown Food" in the nutrition dashboard.
    .not('"AnalysisData"', 'is', null)
    .order('"CreatedAt"', { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return { rows: data || [], count: count || 0 };
}

export async function softDeleteAnalysis(id, userId) {
  const supabase = getSupabaseClient();
  const currentTime = getISTTimestamp();
  const { data, error } = await supabase
    .from('food_nutrition_data_table')
    .update({ IsDeleted: 1, UpdatedAt: currentTime })
    .eq('"ID"', id)
    .eq('"UserID"', userId)
    .select();
  if (error) throw error;
  return data || [];
}

export async function checkOwnership(id, userId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('food_nutrition_data_table')
    .select('"ID"')
    .eq('"ID"', id)
    .eq('"UserID"', userId)
    .limit(1);
  if (error) throw error;
  return Array.isArray(data) && data.length > 0;
}

export async function restoreAnalysis(id) {
  const supabase = getSupabaseClient();
  const currentTime = getISTTimestamp();
  const { data, error } = await supabase
    .from('food_nutrition_data_table')
    .update({ IsDeleted: 0, UpdatedAt: currentTime })
    .eq('"ID"', id)
    .select();
  if (error) throw error;
  return data || [];
}

export async function touchLastActive(userId) {
  if (!userId) return;
  try {
    const supabase = getSupabaseClient();
    await supabase
      .from('team_table')
      .update({ LastActiveAt: getISTTimestamp() })
      .eq('UserId', userId);
  } catch (_) { /* ignore */ }
}

// ─── instant-share helpers ────────────────────────────────────────────────────

/**
 * Insert a "pending" capture row that will be enriched once Gemini analysis
 * completes. The row is immediately addressable by its PublicShareToken.
 */
export async function insertPendingCapture({ userId, imageBase64, publicShareToken, shareExpiresAt }) {
  const supabase = getSupabaseClient();
  const currentTime = getISTTimestamp();
  const { data, error } = await supabase
    .from('food_nutrition_data_table')
    .insert({
      UserID: userId.toString(),
      ImagePath: 'instant-share',
      ImageBase64: imageBase64 || null,
      PublicShareToken: publicShareToken,
      ShareExpiresAt: shareExpiresAt,
      ProcessedBy: 'manual_app',
      DeviceInfo: 'Wellness Valley Web App',
      CreatedAt: currentTime,
      UpdatedAt: currentTime,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Fill in analysis columns on an existing pending-capture row.
 * userId is used as an ownership guard — the UPDATE will silently no-op if
 * the row belongs to a different user.
 */
export async function updateWithAnalysisResult(id, userId, analysisFields) {
  const supabase = getSupabaseClient();
  const currentTime = getISTTimestamp();
  const { data, error } = await supabase
    .from('food_nutrition_data_table')
    .update({ ...analysisFields, UpdatedAt: currentTime })
    .eq('ID', id)
    .eq('UserID', userId.toString())
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Look up a shareable row by its public token.
 * Returns null when not found (no throw — callers treat null as "not found").
 */
export async function findPublicByToken(token) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('food_nutrition_data_table')
    .select('ID, UserID, AnalysisData, TotalCalories, TotalProtein, TotalCarbs, TotalFat, TotalFiber, ShareExpiresAt, CreatedAt, ImageBase64')
    .eq('PublicShareToken', token)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

/**
 * Lightweight lookup used by the deep-link resolve endpoint. Returns just
 * the owner UserID, the meal date, and the share expiry — no image / no
 * nutrition payload. Returns null when no row matches.
 */
export async function findOwnerByToken(token) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('food_nutrition_data_table')
    .select('UserID, CreatedAt, ShareExpiresAt')
    .eq('PublicShareToken', token)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

/**
 * Walk up the coach chain from `startUserId` (inclusive) and return the
 * ordered list of ancestor user-ids. Used by the deep-link permission
 * check: a viewer is allowed to open a shared meal if they are the owner
 * OR appear anywhere in the owner's coach chain. Cap depth at 10 to
 * prevent runaway queries on accidental cycles.
 */
export async function getCoachChain(startUserId) {
  const supabase = getSupabaseClient();
  const chain = [];
  let current = startUserId?.toString();
  let depth = 0;
  while (current && depth < 10) {
    chain.push(current);
    const { data, error } = await supabase
      .from('team_table')
      .select('"CoachId"')
      .eq('"UserId"', current)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    const next = data?.CoachId ? data.CoachId.toString() : null;
    if (!next || next === current || chain.includes(next)) break;
    current = next;
    depth += 1;
  }
  return chain;
}

/**
 * Fetch a user's display name. Returns null when not found.
 */
export async function findUserName(userId) {
  if (!userId) return null;
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('team_table')
    .select('"UserName"')
    .eq('"UserId"', userId.toString())
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.UserName || null;
}

export { getISTTimestamp, convertToIST };
