/**
 * backend/features/background-analysis/diary.repository.js
 *
 * Read-only repository for the Diary feed.
 *
 * The Diary stream is a UNION over four physical tables:
 *
 *   - food_nutrition_data_table        (food rows)
 *   - weight_records_table             (weight rows)
 *   - education_logs_table             (education rows — Topic NOT LIKE 'Calories Burned:%')
 *   - education_logs_table             (watch rows    — Topic LIKE 'Calories Burned:%')
 *   - captures_table                   (unknown rows  — ImageType = 'unknown', flag-gated)
 *   - captures_table                   (pending rows  — ImageType = 'pending', flag-gated;
 *                                       shown immediately after Phase-1 capture save)
 *
 * Each query is scoped to one user + one calendar day via
 * `applyDayFilterWidened()` (±1 day), then the service post-filters to the
 * owner calendar day after normalizing timezone-less CreatedAt as IST.
 *
 * List reads are LEAN: no ImageBase64 / WeightImageBase64. Thumbnails are
 * lazy-loaded via per-vertical image endpoints. AnalysisData is still
 * selected for food so the service can project a small listSummary, then
 * discarded before the HTTP response.
 */

import { getSupabaseClient } from '../../utils/supabaseClient.js';
import { applyDayFilterWidened } from '../../shared/lib/datetime/applyDayFilter.js';
import { IANA_IST, filterFoodRowsByCalendarDay } from '../../shared/lib/datetime/index.js';
import { DIARY_LIST_SQL_CAP } from './domain/diary-pagination.js';

/**
 * Food rows for the day. ImageBase64 omitted — use meal-image API for thumbs.
 * AnalysisData is read only to build listSummary in the service layer.
 */
export async function fetchFoodForDay(ownerUserId, date, timezoneIana = IANA_IST) {
  const supabase = getSupabaseClient();
  let query = supabase
    .from('food_nutrition_data_table')
    .select(
      [
        'ID, ImagePath, AnalysisData, ConfidenceScore',
        'TotalCalories, TotalProtein, TotalCarbs, TotalFat, TotalFiber',
        'TotalSugar, TotalSodium, TotalCholesterol, GlycemicIndex',
        'CaptureID, ProcessedBy, DeviceInfo, CreatedAt',
      ].join(', '),
    )
    .eq('UserID', String(ownerUserId))
    .eq('IsDeleted', 0)
    .not('AnalysisData', 'is', null);
  query = applyDayFilterWidened(query, 'CreatedAt', date, timezoneIana);
  const { data, error } = await query
    .order('CreatedAt', { ascending: false })
    .limit(DIARY_LIST_SQL_CAP);
  if (error) throw error;
  return filterFoodRowsByCalendarDay(data || [], date, timezoneIana, 'CreatedAt');
}

/**
 * Weight rows for the day. WeightImageBase64 omitted — use /api/weight/image.
 */
export async function fetchWeightForDay(ownerUserId, date, timezoneIana = IANA_IST) {
  const supabase = getSupabaseClient();
  let query = supabase
    .from('weight_records_table')
    .select('ID, UserId, Weight, Bmi, BodyFat, MuscleMass, Bmr, CreatedAt')
    .eq('UserId', String(ownerUserId))
    .or('IsDeleted.is.null,IsDeleted.eq.0');
  query = applyDayFilterWidened(query, 'CreatedAt', date, timezoneIana);
  const { data, error } = await query
    .order('CreatedAt', { ascending: false })
    .limit(DIARY_LIST_SQL_CAP);
  if (error) throw error;
  return data || [];
}

/**
 * Education rows for the day — EXCLUDES the `Calories Burned:%` rows
 * that the watch flow writes into the same table.
 */
export async function fetchEducationForDay(ownerUserId, date, timezoneIana = IANA_IST) {
  const supabase = getSupabaseClient();
  let query = supabase
    .from('education_logs_table')
    .select('"Id", "Platform", "Topic", "CreatedAt", "Confidence"')
    .eq('UserId', String(ownerUserId))
    .or('IsDeleted.is.null,IsDeleted.eq.0')
    .not('"Topic"', 'ilike', 'Calories Burned:%');
  query = applyDayFilterWidened(query, 'CreatedAt', date, timezoneIana);
  const { data, error } = await query
    .order('CreatedAt', { ascending: false })
    .limit(DIARY_LIST_SQL_CAP);
  if (error) throw error;
  return data || [];
}

/**
 * Watch (smartwatch screenshot) rows for the day.
 */
export async function fetchWatchForDay(ownerUserId, date, timezoneIana = IANA_IST) {
  const supabase = getSupabaseClient();
  let query = supabase
    .from('education_logs_table')
    .select('"Id", "Topic", "CreatedAt"')
    .eq('"UserId"', String(ownerUserId))
    .eq('"IsDeleted"', 0)
    .ilike('"Topic"', 'Calories Burned:%');
  query = applyDayFilterWidened(query, '"CreatedAt"', date, timezoneIana);
  const { data, error } = await query
    .order('"CreatedAt"', { ascending: false })
    .limit(DIARY_LIST_SQL_CAP);
  if (error) throw error;
  return data || [];
}

/**
 * `unknown` captures for the day. ImageBase64 omitted — lazy thumb via
 * /api/background-analysis/captures/image.
 */
export async function fetchUnknownCapturesForDay(ownerUserId, date, timezoneIana = IANA_IST) {
  const supabase = getSupabaseClient();
  let query = supabase
    .from('captures_table')
    .select('"ID", "UserID", "ImageType", "ImagePath", "PublicShareToken", "CreatedAt"')
    .eq('"UserID"', String(ownerUserId))
    .eq('"IsDeleted"', 0)
    .eq('"ImageType"', 'unknown');
  query = applyDayFilterWidened(query, '"CreatedAt"', date, timezoneIana);
  const { data, error } = await query
    .order('"CreatedAt"', { ascending: false })
    .limit(DIARY_LIST_SQL_CAP);
  if (error) throw error;
  return data || [];
}

/**
 * In-flight captures for the day (`ImageType = 'pending'`).
 */
export async function fetchPendingCapturesForDay(ownerUserId, date, timezoneIana = IANA_IST) {
  const supabase = getSupabaseClient();
  let query = supabase
    .from('captures_table')
    .select('"ID", "UserID", "ImageType", "ImagePath", "PublicShareToken", "CreatedAt"')
    .eq('"UserID"', String(ownerUserId))
    .eq('"IsDeleted"', 0)
    .eq('"ImageType"', 'pending');
  query = applyDayFilterWidened(query, '"CreatedAt"', date, timezoneIana);
  const { data, error } = await query
    .order('"CreatedAt"', { ascending: false })
    .limit(DIARY_LIST_SQL_CAP);
  if (error) throw error;
  return data || [];
}

/**
 * Lazy-load capture photo bytes for diary thumbs / detail.
 * @returns {Promise<{ ImageBase64: string|null, ImagePath: string|null, UserID: string|null }|null>}
 */
export async function fetchCaptureImageById(captureId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('captures_table')
    .select('"ID", "UserID", "ImageBase64", "ImagePath", "IsDeleted"')
    .eq('"ID"', captureId)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.IsDeleted === 1) return null;
  return data;
}
