import { getSupabaseClient } from '../../../utils/supabaseClient.js';

export async function insertHabit(payload) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('good_habits_table')
    .insert(payload)
    .select('"ID", "UserId", "HabitType", "Notes", "CaptureID", "CreatedAt"')
    .single();
  if (error) throw error;
  return data;
}

export async function getHabitImage(id, userId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('good_habits_table')
    .select('"ImageBase64", "AfterImageBase64", "BeforeImageBase64"')
    .eq('"ID"', id)
    .eq('"UserId"', String(userId))
    .eq('"IsDeleted"', 0)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function softDeleteHabit(id, userId, updatedAt) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('good_habits_table')
    .update({ IsDeleted: 1, UpdatedAt: updatedAt })
    .eq('"ID"', id)
    .eq('"UserId"', String(userId))
    .eq('"IsDeleted"', 0)
    .select('"ID"')
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function restoreHabit(id, userId, updatedAt) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('good_habits_table')
    .update({ IsDeleted: 0, UpdatedAt: updatedAt })
    .eq('"ID"', id)
    .eq('"UserId"', String(userId))
    .select('"ID"')
    .maybeSingle();
  if (error) throw error;
  return data;
}
