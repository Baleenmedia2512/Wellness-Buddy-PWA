/**
 * Weight feature — repository layer.
 * The ONLY place in this feature allowed to talk to Supabase / weight_records_table.
 */
import { getSupabaseClient, getISTTimestamp } from '../../utils/supabaseClient.js';

const TABLE = 'weight_records_table';

export async function findPreviousEntry(userId, excludeId = null) {
  const supabase = getSupabaseClient();
  let q = supabase
    .from(TABLE)
    .select('ID, Weight, CreatedAt')
    .eq('UserId', parseInt(userId))
    .or('IsDeleted.is.null,IsDeleted.eq.0')
    .order('CreatedAt', { ascending: false });
  if (excludeId) q = q.neq('ID', excludeId);
  const { data } = await q.limit(1).maybeSingle();
  return data || null;
}

export async function findEntryById(entryId) {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from(TABLE)
    .select('ID, Weight, CreatedAt')
    .eq('ID', entryId)
    .maybeSingle();
  return data || null;
}

export async function syncBmrToTeamTable(userId, bmrValue) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('team_table')
    .update({ Bmr: bmrValue })
    .eq('UserId', parseInt(userId));
  if (error) console.warn('[weight.repository] BMR sync failed:', error.message);
}

export async function insertEntry(payload) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE)
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateEntry(entryId, userId, updates) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE)
    .update({ ...updates, UpdatedAt: getISTTimestamp() })
    .eq('ID', entryId)
    .eq('UserId', parseInt(userId))
    .or('IsDeleted.is.null,IsDeleted.eq.0')
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listHistory(userId, includeImage) {
  const supabase = getSupabaseClient();
  const selectFields = includeImage
    ? 'ID, UserId, Weight, Bmi, BodyFat, MuscleMass, Bmr, WeightImageBase64, CreatedAt'
    : 'ID, UserId, Weight, Bmi, BodyFat, MuscleMass, Bmr, CreatedAt';
  const { data, error } = await supabase
    .from(TABLE)
    .select(selectFields)
    .eq('UserId', userId)
    .or('IsDeleted.is.null,IsDeleted.eq.0')
    .order('CreatedAt', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function softDelete(entryId, userId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE)
    .update({ IsDeleted: 1, UpdatedAt: getISTTimestamp() })
    .eq('ID', entryId)
    .eq('UserId', userId)
    .select();
  if (error) throw error;
  return data || [];
}

export async function checkOwnership(entryId, userId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select('"ID"')
    .eq('"ID"', entryId)
    .eq('"UserId"', userId)
    .limit(1);
  if (error) throw error;
  return Array.isArray(data) && data.length > 0;
}

export async function restoreEntry(entryId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE)
    .update({ IsDeleted: 0, UpdatedAt: getISTTimestamp() })
    .eq('"ID"', entryId)
    .select();
  if (error) throw error;
  return data || [];
}
