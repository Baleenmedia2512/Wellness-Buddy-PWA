import { getSupabaseClient, getISTTimestamp, convertToIST } from '../../utils/supabaseClient.js';

export async function insertLog(payload) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('education_logs_table')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listLogs(userId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('education_logs_table')
    .select('"Id", "Platform", "Topic", "CreatedAt", "Confidence", "ImageBase64"')
    .eq('"UserId"', userId)
    .or('"IsDeleted".is.null,"IsDeleted".eq.0')
    .order('"CreatedAt"', { ascending: false })
    .limit(100);
  if (error) throw error;
  return data || [];
}

export async function getLogImage(logId, userId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('education_logs_table')
    .select('"ImageBase64"')
    .eq('"Id"', logId)
    .eq('"UserId"', userId)
    .single();
  if (error || !data) return null;
  return data;
}

export async function summaryLogs(userId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('education_logs_table')
    .select('"CreatedAt", "Platform"')
    .eq('"UserId"', userId)
    .eq('"IsDeleted"', 0)
    .order('"CreatedAt"', { ascending: false })
    .limit(1000);
  if (error) throw error;
  return data || [];
}

export async function softDeleteLog(logId, userId) {
  const supabase = getSupabaseClient();
  const currentTime = getISTTimestamp();
  const { data, error } = await supabase
    .from('education_logs_table')
    .update({ IsDeleted: 1, UpdatedAt: currentTime })
    .eq('"Id"', logId)
    .eq('"UserId"', userId)
    .select();
  if (error) throw error;
  return data || [];
}

export async function checkOwnership(id, userId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('education_logs_table')
    .select('"Id"')
    .eq('"Id"', id)
    .eq('"UserId"', userId)
    .limit(1);
  if (error) throw error;
  return Array.isArray(data) && data.length > 0;
}

export async function restoreLog(id) {
  const supabase = getSupabaseClient();
  const currentTime = getISTTimestamp();
  const { data, error } = await supabase
    .from('education_logs_table')
    .update({ IsDeleted: 0, UpdatedAt: currentTime })
    .eq('"Id"', id)
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

export { getISTTimestamp, convertToIST };
