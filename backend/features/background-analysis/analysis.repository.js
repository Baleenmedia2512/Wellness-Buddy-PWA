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
    .select('ID, AnalysisData, TotalCalories, TotalProtein, TotalCarbs, TotalFat, TotalFiber, ShareExpiresAt, CreatedAt, ImageBase64')
    .eq('PublicShareToken', token)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export { getISTTimestamp, convertToIST };
