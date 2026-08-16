import { getSupabaseClient } from '../../../utils/supabaseClient.js';
import logger from '../../../shared/lib/logger.js';
import { applyDayFilterWidened } from '../../../shared/lib/datetime/applyDayFilter.js';
import { IANA_IST, filterRowsByCalendarDay } from '../../../shared/lib/datetime/index.js';

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

export async function listHabitsForDate(userId, date, timezoneIana = IANA_IST) {
  if (userId == null || String(userId).trim() === '') return [];
  const supabase = getSupabaseClient();
  let query = supabase
    .from('good_habits_table')
    .select('"CreatedAt", "HabitType"')
    .eq('"UserId"', String(userId))
    .eq('"IsDeleted"', 0);
  query = applyDayFilterWidened(query, 'CreatedAt', date, timezoneIana);
  const { data, error } = await query;
  if (error) {
    logger.error('[good-habits.repo] listHabitsForDate failed', {
      userId: String(userId),
      date,
      err: error.message,
    });
    return [];
  }
  return filterRowsByCalendarDay(data || [], date, timezoneIana, 'CreatedAt');
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
