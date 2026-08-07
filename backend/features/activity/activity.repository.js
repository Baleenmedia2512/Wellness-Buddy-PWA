import { getSupabaseClient } from '../../utils/supabaseClient.js';
import { nowUtc } from '../../shared/lib/datetime/index.js';
import {
  applyDayFilter,
  applyDayFilterWidened,
  applyDateRangeFilter,
  applyDateRangeFilterWidened,
} from '../../shared/lib/datetime/applyDayFilter.js';
import { IANA_IST } from '../../shared/lib/datetime/index.js';
import { filterWatchCalorieRowsForDate } from './domain/watch-calories.helpers.js';

export async function fetchDailyRows(userId, startDate, endDate, activityType = null, timezoneIana = IANA_IST) {
  const supabase = getSupabaseClient();
  let query = supabase
    .from('daily_step_activity')
    .select('*')
    .eq('UserId', userId);
  query = applyDateRangeFilter(query, 'CreatedAt', startDate, endDate, timezoneIana);
  query = query.order('CreatedAt', { ascending: true });
  if (activityType) query = query.eq('ActivityType', activityType);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function findExistingDailyRows(userId, activityDate, timezoneIana = IANA_IST) {
  const supabase = getSupabaseClient();
  let query = supabase
    .from('daily_step_activity')
    .select('Id, Steps, CaloriesBurned')
    .eq('UserId', userId);
  query = applyDayFilter(query, 'CreatedAt', activityDate, timezoneIana);
  const { data, error } = await query
    .order('CreatedAt', { ascending: false })
    .limit(2);
  if (error) throw error;
  return data || [];
}

export async function updateDailyRow(id, payload) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('daily_step_activity')
    .update(payload)
    .eq('Id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function insertDailyRow(payload) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('daily_step_activity')
    .insert(payload)
    .select('*')
    .single();
  return { data, error };
}

export async function fetchWatchCalorieRows(userId, targetDate, timezoneIana = IANA_IST) {
  const supabase = getSupabaseClient();
  let query = supabase
    .from('education_logs_table')
    .select('"Id", "Topic", "CreatedAt"')
    .eq('"UserId"', String(userId))
    .or('IsDeleted.is.null,IsDeleted.eq.0')
    .ilike('"Topic"', 'Calories Burned:%');
  // Education watch logs store CreatedAt as legacy IST wall-clock (no zone).
  // Mirror diary.repository fetchWatchForDay: widen SQL bounds, then post-filter.
  query = applyDayFilterWidened(query, '"CreatedAt"', targetDate, timezoneIana);
  const { data, error } = await query.order('"CreatedAt"', { ascending: false });
  if (error) throw error;
  return filterWatchCalorieRowsForDate(data, targetDate, timezoneIana);
}

/**
 * Watch calorie rows for an inclusive calendar range (home carousel).
 * Widened SQL + caller groups/filters by calendar day.
 */
export async function fetchWatchCalorieRowsForRange(userId, startDate, endDate, timezoneIana = IANA_IST) {
  const supabase = getSupabaseClient();
  let query = supabase
    .from('education_logs_table')
    .select('"Id", "Topic", "CreatedAt"')
    .eq('"UserId"', String(userId))
    .or('IsDeleted.is.null,IsDeleted.eq.0')
    .ilike('"Topic"', 'Calories Burned:%');
  query = applyDateRangeFilterWidened(query, '"CreatedAt"', startDate, endDate, timezoneIana);
  const { data, error } = await query.order('"CreatedAt"', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function touchLastActive(userId) {
  if (!userId) return;
  try {
    const supabase = getSupabaseClient();
    await supabase.from('team_table').update({ LastActiveAt: nowUtc() }).eq('UserId', userId);
  } catch (_) { /* ignore */ }
}
