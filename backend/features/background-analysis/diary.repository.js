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
 *
 * Each query is scoped to one user + one IST calendar day. Today's date
 * window matches the existing convention in
 * `food-corrections.repository.js :: fetchMealsForDate` and
 * `activity.repository.js :: fetchWatchCalorieRows` — naive
 * `YYYY-MM-DDT00:00:00` strings (food) and `+05:30` offset strings
 * (watch). We mirror each table's existing predicate so a row that
 * shows up in its own dashboard tab today MUST show up in the diary
 * for the same day.
 */

import { getSupabaseClient } from '../../utils/supabaseClient.js';

// food_nutrition_data_table / weight_records_table / education_logs_table store
// CreatedAt as "timestamp without time zone" using IST space format
// (e.g. "2026-06-23 15:17:00") from convertToIST — not ISO "T" format.
const istDayBounds = (date) => ({
  start: `${date} 00:00:00`,
  end:   `${date} 23:59:59`,
});

const istDayBoundsWithOffset = (date) => ({
  start: `${date}T00:00:00+05:30`,
  end:   `${date}T23:59:59+05:30`,
});

/**
 * Food rows for the day. Mirrors `food-corrections.repository.js ::
 * fetchMealsForDate` — same column list (truncated to what the Diary
 * cards actually render), same IsDeleted + AnalysisData IS NOT NULL
 * guards. The micronutrient columns are intentionally omitted here;
 * the Diary feed card renders summary nutrition only, and the
 * existing per-meal detail modal still fetches the full row via the
 * established food-corrections endpoint.
 */
export async function fetchFoodForDay(ownerUserId, date) {
  const supabase = getSupabaseClient();
  const { start, end } = istDayBounds(date);
  const { data, error } = await supabase
    .from('food_nutrition_data_table')
    .select(
      [
        'ID, ImagePath, ImageBase64, AnalysisData, ConfidenceScore',
        'TotalCalories, TotalProtein, TotalCarbs, TotalFat, TotalFiber',
        'CaptureID, ProcessedBy, DeviceInfo, CreatedAt',
      ].join(', '),
    )
    .eq('UserID', String(ownerUserId))
    .eq('IsDeleted', 0)
    .not('AnalysisData', 'is', null)
    .gte('CreatedAt', start)
    .lte('CreatedAt', end)
    .order('CreatedAt', { ascending: false });
  if (error) throw error;
  return data || [];
}

/**
 * Weight rows for the day. Mirrors `weight.repository.js :: listHistory`
 * but date-scoped. IsDeleted nullable-or-zero per the existing weight
 * convention (the column was added later than the table).
 */
export async function fetchWeightForDay(ownerUserId, date) {
  const supabase = getSupabaseClient();
  const { start, end } = istDayBounds(date);
  const { data, error } = await supabase
    .from('weight_records_table')
    .select('ID, UserId, Weight, Bmi, BodyFat, MuscleMass, Bmr, WeightImageBase64, CreatedAt')
    .eq('UserId', String(ownerUserId))
    .or('IsDeleted.is.null,IsDeleted.eq.0')
    .gte('CreatedAt', start)
    .lte('CreatedAt', end)
    .order('CreatedAt', { ascending: false });
  if (error) throw error;
  return data || [];
}

/**
 * Education rows for the day — EXCLUDES the `Calories Burned:%` rows
 * that the watch flow writes into the same table (those land in the
 * watch stream below). Mirrors `education.repository.js :: listLogs`
 * predicates.
 */
export async function fetchEducationForDay(ownerUserId, date) {
  const supabase = getSupabaseClient();
  const { start, end } = istDayBounds(date);
  const { data, error } = await supabase
    .from('education_logs_table')
    .select('"Id", "Platform", "Topic", "CreatedAt", "Confidence", "ImageBase64"')
    .eq('UserId', String(ownerUserId))
    .or('IsDeleted.is.null,IsDeleted.eq.0')
    .not('"Topic"', 'ilike', 'Calories Burned:%')
    .gte('CreatedAt', start)
    .lte('CreatedAt', end)
    .order('CreatedAt', { ascending: false });
  if (error) throw error;
  return data || [];
}

/**
 * Watch (smartwatch screenshot) rows for the day. Mirrors
 * `activity.repository.js :: fetchWatchCalorieRows` — same
 * `Topic ILIKE 'Calories Burned:%'` predicate, same IST-offset window.
 */
export async function fetchWatchForDay(ownerUserId, date) {
  const supabase = getSupabaseClient();
  const { start, end } = istDayBoundsWithOffset(date);
  const { data, error } = await supabase
    .from('education_logs_table')
    .select('"Id", "Topic", "CreatedAt"')
    .eq('"UserId"', String(ownerUserId))
    .eq('"IsDeleted"', 0)
    .ilike('"Topic"', 'Calories Burned:%')
    .gte('"CreatedAt"', start)
    .lte('"CreatedAt"', end)
    .order('"CreatedAt"', { ascending: false });
  if (error) throw error;
  return data || [];
}

/**
 * `unknown` captures for the day. Only rows whose user-facing AI
 * classification ended up as `unknown` are surfaced — `pending` and
 * terminal types other than `unknown` are excluded so the Diary feed
 * never shows the in-flight or already-classified states.
 *
 * Reads `captures_table` directly — Diary feed is the only consumer
 * that needs this date-windowed predicate, so the query lives here
 * rather than as another `captures` slice export (avoiding scope
 * sprawl per claude.md §4.3 "no second source of truth"). If a
 * second consumer appears, lift it into `captures/data/`.
 */
export async function fetchUnknownCapturesForDay(ownerUserId, date) {
  const supabase = getSupabaseClient();
  const { start, end } = istDayBounds(date);
  const { data, error } = await supabase
    .from('captures_table')
    .select('"ID", "UserID", "ImageType", "ImageBase64", "ImagePath", "PublicShareToken", "CreatedAt"')
    .eq('"UserID"', String(ownerUserId))
    .eq('"IsDeleted"', 0)
    .eq('"ImageType"', 'unknown')
    .gte('"CreatedAt"', start)
    .lte('"CreatedAt"', end)
    .order('"CreatedAt"', { ascending: false });
  if (error) throw error;
  return data || [];
}
