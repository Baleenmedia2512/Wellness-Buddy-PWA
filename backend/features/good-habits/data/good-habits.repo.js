import { getSupabaseClient } from '../../../utils/supabaseClient.js';
import logger from '../../../shared/lib/logger.js';
import { applyDayFilterWidened } from '../../../shared/lib/datetime/applyDayFilter.js';
import {
  IANA_IST,
  filterRowsByCalendarDay,
  filterRowsByCalendarDateRange,
  shiftDateYmd,
} from '../../../shared/lib/datetime/index.js';

function isMissingColumn(error, columnName) {
  const msg = String(error?.message || error || '');
  return /column/i.test(msg) && new RegExp(columnName, 'i').test(msg);
}

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

export async function updateGoodHabitImageKeys(habitId, userId, patch) {
  const supabase = getSupabaseClient();
  const safePatch = {};
  if (patch?.ImageKey) safePatch.ImageKey = patch.ImageKey;
  if (patch?.BeforeImageKey) safePatch.BeforeImageKey = patch.BeforeImageKey;
  if (patch?.AfterImageKey) safePatch.AfterImageKey = patch.AfterImageKey;
  if (!Object.keys(safePatch).length) return;
  const { error } = await supabase
    .from('good_habits_table')
    .update(safePatch)
    .eq('"ID"', habitId)
    .eq('"UserId"', String(userId));
  if (error) {
    if (
      isMissingColumn(error, 'ImageKey')
      || isMissingColumn(error, 'BeforeImageKey')
      || isMissingColumn(error, 'AfterImageKey')
    ) {
      throw new Error('Run migration add_image_keys_to_good_habits_table.sql before good-habit R2');
    }
    throw error;
  }
}

function habitNeedsImageBackfill(row) {
  return Boolean(
    (!row.ImageKey && row.ImageBase64)
    || (!row.BeforeImageKey && row.BeforeImageBase64)
    || (!row.AfterImageKey && row.AfterImageBase64),
  );
}

/**
 * Good-habit photos in the IST calendar window missing at least one R2 key.
 */
export async function listPendingGoodHabitImageBackfill({
  from = 0,
  to = 49,
  startYmd,
  endYmd,
} = {}) {
  const supabase = getSupabaseClient();
  const endExclusiveYmd = shiftDateYmd(endYmd, 1, IANA_IST);
  const { data, error } = await supabase
    .from('good_habits_table')
    .select('"ID", "UserId", "ImageBase64", "BeforeImageBase64", "AfterImageBase64", "ImageKey", "BeforeImageKey", "AfterImageKey", "CreatedAt"')
    .eq('"IsDeleted"', 0)
    .or('ImageBase64.not.is.null,BeforeImageBase64.not.is.null,AfterImageBase64.not.is.null')
    .gte('CreatedAt', `${startYmd} 00:00:00`)
    .lt('CreatedAt', `${endExclusiveYmd} 00:00:00`)
    .order('CreatedAt', { ascending: true })
    .order('"ID"', { ascending: true })
    .range(from, to);
  if (error) {
    if (
      isMissingColumn(error, 'ImageKey')
      || isMissingColumn(error, 'BeforeImageKey')
      || isMissingColumn(error, 'AfterImageKey')
    ) {
      throw new Error('Run migration add_image_keys_to_good_habits_table.sql before backfill');
    }
    throw error;
  }
  return filterRowsByCalendarDateRange(data || [], startYmd, endYmd, IANA_IST, 'CreatedAt')
    .filter(habitNeedsImageBackfill);
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
