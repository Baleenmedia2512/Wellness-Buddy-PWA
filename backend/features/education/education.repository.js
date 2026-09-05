import { getSupabaseClient } from '../../utils/supabaseClient.js';
import {
  nowUtc,
  IANA_IST,
  shiftDateYmd,
  filterRowsByCalendarDateRange,
} from '../../shared/lib/datetime/index.js';

function isMissingColumn(error, columnName) {
  const msg = String(error?.message || error || '');
  return /column/i.test(msg) && new RegExp(columnName, 'i').test(msg);
}

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

export async function listLogs(userId, { limit = null, offset = 0, includeImage = true } = {}) {
  const supabase = getSupabaseClient();
  const selectFields = includeImage
    ? '"Id", "Platform", "Topic", "CreatedAt", "Confidence", "ImageBase64"'
    : '"Id", "Platform", "Topic", "CreatedAt", "Confidence"';
  let query = supabase
    .from('education_logs_table')
    .select(selectFields)
    .eq('UserId', userId)
    .or('IsDeleted.is.null,IsDeleted.eq.0')
    .order('CreatedAt', { ascending: false });
  const useLimit = Number.isFinite(limit) && limit > 0;
  const fromIdx = Number.isFinite(offset) && offset >= 0 ? offset : 0;
  if (useLimit) {
    query = query.range(fromIdx, fromIdx + limit - 1);
  } else {
    query = query.limit(100);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function countLogs(userId) {
  const supabase = getSupabaseClient();
  const { count, error } = await supabase
    .from('education_logs_table')
    .select('"Id"', { count: 'exact', head: true })
    .eq('UserId', userId)
    .or('IsDeleted.is.null,IsDeleted.eq.0');
  if (error) return null;
  return typeof count === 'number' ? count : null;
}

export async function updateEducationImageKey(logId, userId, imageKey) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('education_logs_table')
    .update({ ImageKey: imageKey })
    .eq('"Id"', logId)
    .eq('"UserId"', userId);
  if (error) {
    if (isMissingColumn(error, 'ImageKey')) {
      throw new Error('Run migration add_image_key_to_education_logs_table.sql before education R2');
    }
    throw error;
  }
}

/**
 * Education photos in the IST calendar window that have not been copied to R2 yet.
 */
export async function listPendingEducationImageBackfill({
  from = 0,
  to = 49,
  startYmd,
  endYmd,
} = {}) {
  const supabase = getSupabaseClient();
  const endExclusiveYmd = shiftDateYmd(endYmd, 1, IANA_IST);
  const { data, error } = await supabase
    .from('education_logs_table')
    .select('"Id", "UserId", "ImageBase64", "ImageKey", "CreatedAt"')
    .or('IsDeleted.is.null,IsDeleted.eq.0')
    .is('ImageKey', null)
    .not('ImageBase64', 'is', null)
    .gte('CreatedAt', `${startYmd} 00:00:00`)
    .lt('CreatedAt', `${endExclusiveYmd} 00:00:00`)
    .order('CreatedAt', { ascending: true })
    .order('"Id"', { ascending: true })
    .range(from, to);
  if (error) {
    if (isMissingColumn(error, 'ImageKey')) {
      throw new Error('Run migration add_image_key_to_education_logs_table.sql before backfill');
    }
    throw error;
  }
  return filterRowsByCalendarDateRange(data || [], startYmd, endYmd, IANA_IST, 'CreatedAt');
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
    .eq('UserId', userId)
    .eq('IsDeleted', 0)
    .order('CreatedAt', { ascending: false })
    .limit(1000);
  if (error) throw error;
  return data || [];
}

export async function softDeleteLog(logId, userId) {
  const supabase = getSupabaseClient();
  const currentTime = nowUtc();
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
  const currentTime = nowUtc();
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
      .update({ LastActiveAt: nowUtc() })
      .eq('UserId', userId);
  } catch (_) { /* ignore */ }
}
