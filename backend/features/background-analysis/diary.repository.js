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
 * Each query is scoped to one user + one calendar day via `applyDayFilter()`.
 */

import { getSupabaseClient } from '../../utils/supabaseClient.js';
import { applyDayFilter } from '../../shared/lib/datetime/applyDayFilter.js';
import { IANA_IST } from '../../shared/lib/datetime/index.js';

/**
 * Food rows for the day. Mirrors `food-corrections.repository.js ::
 * fetchMealsForDate` — same column list (truncated to what the Diary
 * cards actually render), same IsDeleted + AnalysisData IS NOT NULL
 * guards. Micronutrient summary columns (sugar/sodium/cholesterol) are
 * included for diary share cards; full detail still uses food-corrections.
 */
export async function fetchFoodForDay(ownerUserId, date, timezoneIana = IANA_IST) {
  const supabase = getSupabaseClient();
  let query = supabase
    .from('food_nutrition_data_table')
    .select(
      [
        'ID, ImagePath, ImageBase64, AnalysisData, ConfidenceScore',
        'TotalCalories, TotalProtein, TotalCarbs, TotalFat, TotalFiber',
        'TotalSugar, TotalSodium, TotalCholesterol',
        'CaptureID, ProcessedBy, DeviceInfo, CreatedAt',
      ].join(', '),
    )
    .eq('UserID', String(ownerUserId))
    .eq('IsDeleted', 0)
    .not('AnalysisData', 'is', null);
  query = applyDayFilter(query, 'CreatedAt', date, timezoneIana);
  const { data, error } = await query.order('CreatedAt', { ascending: false });
  if (error) throw error;
  return data || [];
}

/**
 * Weight rows for the day. Mirrors `weight.repository.js :: listHistory`
 * but date-scoped. IsDeleted nullable-or-zero per the existing weight
 * convention (the column was added later than the table).
 */
export async function fetchWeightForDay(ownerUserId, date, timezoneIana = IANA_IST) {
  const supabase = getSupabaseClient();
  let query = supabase
    .from('weight_records_table')
    .select('ID, UserId, Weight, Bmi, BodyFat, MuscleMass, Bmr, WeightImageBase64, CreatedAt')
    .eq('UserId', String(ownerUserId))
    .or('IsDeleted.is.null,IsDeleted.eq.0');
  query = applyDayFilter(query, 'CreatedAt', date, timezoneIana);
  const { data, error } = await query.order('CreatedAt', { ascending: false });
  if (error) throw error;
  return data || [];
}

/**
 * Education rows for the day — EXCLUDES the `Calories Burned:%` rows
 * that the watch flow writes into the same table (those land in the
 * watch stream below). Mirrors `education.repository.js :: listLogs`
 * predicates.
 */
export async function fetchEducationForDay(ownerUserId, date, timezoneIana = IANA_IST) {
  const supabase = getSupabaseClient();
  let query = supabase
    .from('education_logs_table')
    .select('"Id", "Platform", "Topic", "CreatedAt", "Confidence", "ImageBase64"')
    .eq('UserId', String(ownerUserId))
    .or('IsDeleted.is.null,IsDeleted.eq.0')
    .not('"Topic"', 'ilike', 'Calories Burned:%');
  query = applyDayFilter(query, 'CreatedAt', date, timezoneIana);
  const { data, error } = await query.order('CreatedAt', { ascending: false });
  if (error) throw error;
  return data || [];
}

/**
 * Watch (smartwatch screenshot) rows for the day. Mirrors
 * `activity.repository.js :: fetchWatchCalorieRows` — same
 * `Topic ILIKE 'Calories Burned:%'` predicate.
 */
export async function fetchWatchForDay(ownerUserId, date, timezoneIana = IANA_IST) {
  const supabase = getSupabaseClient();
  let query = supabase
    .from('education_logs_table')
    .select('"Id", "Topic", "CreatedAt"')
    .eq('"UserId"', String(ownerUserId))
    .eq('"IsDeleted"', 0)
    .ilike('"Topic"', 'Calories Burned:%');
  query = applyDayFilter(query, '"CreatedAt"', date, timezoneIana);
  const { data, error } = await query.order('"CreatedAt"', { ascending: false });
  if (error) throw error;
  return data || [];
}

/**
 * `unknown` captures for the day. Only rows whose user-facing AI
 * classification ended up as `unknown` are surfaced — `pending` and
 * terminal types other than `unknown` are excluded so the Diary feed
 * never shows the in-flight or already-classified states.
 */
export async function fetchUnknownCapturesForDay(ownerUserId, date, timezoneIana = IANA_IST) {
  const supabase = getSupabaseClient();
  let query = supabase
    .from('captures_table')
    .select('"ID", "UserID", "ImageType", "ImageBase64", "ImagePath", "PublicShareToken", "CreatedAt"')
    .eq('"UserID"', String(ownerUserId))
    .eq('"IsDeleted"', 0)
    .eq('"ImageType"', 'unknown');
  query = applyDayFilter(query, '"CreatedAt"', date, timezoneIana);
  const { data, error } = await query.order('"CreatedAt"', { ascending: false });
  if (error) throw error;
  return data || [];
}

/**
 * In-flight captures for the day (`ImageType = 'pending'`).
 * Surfaced in the Diary feed immediately after Phase-1 POST /captures so
 * the user sees their photo while background AI runs. Once classified, the
 * row is promoted to a terminal type and disappears from this query.
 */
export async function fetchPendingCapturesForDay(ownerUserId, date, timezoneIana = IANA_IST) {
  const supabase = getSupabaseClient();
  let query = supabase
    .from('captures_table')
    .select('"ID", "UserID", "ImageType", "ImageBase64", "ImagePath", "PublicShareToken", "CreatedAt"')
    .eq('"UserID"', String(ownerUserId))
    .eq('"IsDeleted"', 0)
    .eq('"ImageType"', 'pending');
  query = applyDayFilter(query, '"CreatedAt"', date, timezoneIana);
  const { data, error } = await query.order('"CreatedAt"', { ascending: false });
  if (error) throw error;
  return data || [];
}
