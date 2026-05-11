import { getSupabaseClient, getISTTimestamp } from '../../utils/supabaseClient.js';

export async function findUserIdByEmail(email) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('team_table')
    .select('"UserId"')
    .eq('"Email"', email)
    .limit(1);
  if (error) throw error;
  return Array.isArray(data) && data.length > 0 ? data[0].UserId : null;
}

export async function findUserRoleAndId(email) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('team_table')
    .select('Role, UserId')
    .eq('Email', email)
    .maybeSingle();
  if (error) return null;
  return data;
}

export async function insertUsage(payload) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('ai_token_usage_table')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function findCorrection(userId, timeRange) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('token_correction_table')
    .select('*')
    .eq('"UserId"', userId)
    .eq('"TimeRange"', timeRange || 'all')
    .limit(1);
  if (error && error.code !== 'PGRST116') return [];
  return data || [];
}

export async function updateCorrection(userId, timeRange, correctionData) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('token_correction_table')
    .update(correctionData)
    .eq('"UserId"', userId)
    .eq('"TimeRange"', timeRange || 'all');
  if (error) throw error;
}

export async function insertCorrection(correctionData) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('token_correction_table')
    .insert(correctionData);
  if (error) throw error;
}

export async function deactivatePricing(modelName) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('token_pricing_table')
    .update({ IsActive: false })
    .eq('"ModelName"', modelName)
    .eq('"IsActive"', true);
  return { error };
}

export async function insertPricing(payload) {
  const supabase = getSupabaseClient();
  return supabase.from('token_pricing_table').insert(payload).select();
}

export async function getActivePricing(modelName) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('token_pricing_table')
    .select('*')
    .eq('"ModelName"', modelName)
    .eq('"IsActive"', true)
    .order('"UpdatedAt"', { ascending: false })
    .limit(1);
  if (error) throw error;
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}

export async function getCorrectionForRange(userId, timeRange) {
  const supabase = getSupabaseClient();
  let query = supabase
    .from('token_correction_table')
    .select('"InputTokenCost", "OutputTokenCost", "TotalTokenCost", "CreatedAt", "TimeRange", "StartDate", "EndDate"')
    .eq('"UserId"', userId);
  if (timeRange) query = query.eq('"TimeRange"', timeRange);
  const { data, error } = await query.order('"CreatedAt"', { ascending: false }).limit(1);
  if (error) throw error;
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}

export async function getLatestUsageTimestamp(email) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('ai_token_usage_table')
    .select('"CreatedAt"')
    .eq('"Email"', email)
    .order('"CreatedAt"', { ascending: false })
    .limit(1);
  if (error) throw error;
  return Array.isArray(data) && data.length > 0 ? data[0].CreatedAt : null;
}

export async function getLatestUsageRecord(email) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('ai_token_usage_table')
    .select('"InputTokenCost", "OutputTokenCost", "TotalTokenCost", "CreatedAt"')
    .eq('"Email"', email)
    .order('"CreatedAt"', { ascending: false })
    .limit(1);
  if (error) throw error;
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}

export async function getLatestCorrectionByUserId(userId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('token_correction_table')
    .select('"InputTokenCost", "OutputTokenCost", "TotalTokenCost", "CreatedAt"')
    .eq('"UserId"', userId)
    .order('"CreatedAt"', { ascending: false })
    .limit(1);
  if (error) throw error;
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}

export async function queryUsageRecords({ startDateISO, endDateISO, operationType, model }) {
  const supabase = getSupabaseClient();
  let query = supabase
    .from('ai_token_usage_table')
    .select('*')
    .gte('CreatedAt', startDateISO)
    .lte('CreatedAt', endDateISO);
  if (operationType && operationType !== 'all') query = query.eq('OperationType', operationType);
  if (model && model !== 'all') query = query.eq('ModelName', model);
  const { data, error } = await query.order('CreatedAt', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getCorrectionByRange(userId, effectiveTimeRange) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('token_correction_table')
    .select('InputTokenCost, OutputTokenCost, TotalTokenCost, TimeRange, CreatedAt')
    .eq('UserId', userId)
    .eq('TimeRange', effectiveTimeRange)
    .maybeSingle();
  if (error) return null;
  return data;
}

export async function hasNewerUsage(startDateISO, endDateISO, sinceISO) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('ai_token_usage_table')
    .select('ID, CreatedAt')
    .gte('CreatedAt', startDateISO)
    .lte('CreatedAt', endDateISO)
    .gt('CreatedAt', sinceISO)
    .limit(1);
  if (error) return false;
  return Array.isArray(data) && data.length > 0;
}

export async function getUserNamesByIds(userIds) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('team_table')
    .select('UserId, UserName')
    .in('UserId', userIds);
  if (error) return [];
  return data || [];
}

export async function reverseLookupCorrection(correctedName) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('food_corrections_table')
    .select('"AiDetected", "UserCorrected", "LastCorrected", "UserId"')
    .eq('"UserCorrected"', correctedName)
    .order('"LastCorrected"', { ascending: false })
    .limit(1);
  if (error) throw error;
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}

export { getISTTimestamp };
