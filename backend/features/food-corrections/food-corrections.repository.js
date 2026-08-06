import { getSupabaseClient } from '../../utils/supabaseClient.js';
import { nowUtc } from '../../shared/lib/datetime/index.js';
import {
  applyDayFilter,
  applyDayFilterWidened,
  applyDateRangeFilter,
  applySinceDayStartFilter,
} from '../../shared/lib/datetime/applyDayFilter.js';
import {
  IANA_IST,
  todayInTimezone,
  shiftDateYmd,
  filterFoodRowsByCalendarDay,
} from '../../shared/lib/datetime/index.js';

// ─── corrections table ──────────────────────────────────────────────────────
export async function listUserCorrections(userId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('food_corrections_table')
    .select('"Id", "AiDetected", "UserCorrected", "TimesCorrected", "CreatedAt", "LastCorrected"')
    .eq('"UserId"', userId)
    .order('"TimesCorrected"', { ascending: false })
    .order('"LastCorrected"', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function findCorrection(userId, aiDetected, userCorrected) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('food_corrections_table')
    .select('*')
    .eq('"UserId"', userId)
    .eq('"AiDetected"', aiDetected)
    .eq('"UserCorrected"', userCorrected)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateCorrection(id, payload) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('food_corrections_table')
    .update(payload)
    .eq('"Id"', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function insertCorrection(payload) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('food_corrections_table')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listAllCorrections() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('food_corrections_table')
    .select(`
      "AiDetected", "UserCorrected", "UserId", "TimesCorrected", "LastCorrected",
      "CorrectedQuantity", "CorrectedUnit", "CorrectedFoodType",
      "CorrectedCalories", "CorrectedCarbs", "CorrectedProtein", "CorrectedFat", "CorrectedFiber"
    `)
    .order('"LastCorrected"', { ascending: false });
  if (error) throw error;
  return data || [];
}

// ─── nutrition table ────────────────────────────────────────────────────────
export async function searchUserMeals(userId, term) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('food_nutrition_data_table')
    .select('"ID","AnalysisData","CreatedAt"')
    .eq('"UserID"', userId)
    .eq('"IsDeleted"', 0)
    .ilike('"AnalysisData"', `%${term}%`)
    .order('"CreatedAt"', { ascending: false })
    .limit(100);
  if (error) throw error;
  return data || [];
}

export async function searchCommunityMeals(userId, term) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('food_nutrition_data_table')
    .select('"ID","AnalysisData","CreatedAt"')
    .neq('"UserID"', userId)
    .eq('"IsDeleted"', 0)
    .ilike('"AnalysisData"', `%${term}%`)
    .order('"CreatedAt"', { ascending: false })
    .limit(200);
  if (error) throw error;
  return data || [];
}

export async function updateMealAnalysis(id, userId, payload) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('food_nutrition_data_table')
    .update(payload)
    .eq('"ID"', id)
    .eq('"UserID"', userId)
    .select();
  if (error) throw error;
  return data || [];
}

/** Read-only: existing GlycemicIndex for a meal owned by userId (edit preserve). */
export async function fetchMealGlycemicIndex(id, userId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('food_nutrition_data_table')
    .select('GlycemicIndex')
    .eq('"ID"', id)
    .eq('"UserID"', userId)
    .maybeSingle();
  if (error) throw error;
  const gi = data?.GlycemicIndex;
  return gi != null && Number.isFinite(Number(gi)) ? Math.round(Number(gi)) : null;
}

export async function fetchMealsForDate(userId, date, timezoneIana = IANA_IST) {
  const supabase = getSupabaseClient();
  let query = supabase
    .from('food_nutrition_data_table')
    // ImageBase64 omitted on purpose — list responses were multi-100KB; use meal-image API.
    .select([
      'ID, ImagePath, AnalysisData, ConfidenceScore',
      'TotalCalories, TotalProtein, TotalCarbs, TotalFat, TotalFiber',
      'TotalSugar, TotalSodium, TotalCholesterol, GlycemicIndex',
      'TotalVitaminA, TotalVitaminC, TotalVitaminD, TotalVitaminE, TotalVitaminK',
      'TotalVitaminB1, TotalVitaminB2, TotalVitaminB3, TotalVitaminB6, TotalVitaminB9, TotalVitaminB12',
      'TotalCalcium, TotalIron, TotalMagnesium, TotalPotassium, TotalZinc, TotalPhosphorus',
      'ProcessedBy, DeviceInfo, CreatedAt',
    ].join(', '))
    .eq('UserID', String(userId))
    .eq('IsDeleted', 0)
    // PR 6 — defensive: exclude rows whose AnalysisData never landed (failed
    // mid-write, or — pre-PR-6 — speculative pending-capture orphans left
    // behind when the capture turned out to be weight/education/smartwatch).
    // Matches the same predicate already enforced by `listAnalyses`.
    .not('AnalysisData', 'is', null);
  // Widen SQL bounds, then post-filter with canonical food CreatedAt interpretation
  // (handles legacy IST wall + spurious driver Z/+00:00).
  query = applyDayFilterWidened(query, 'CreatedAt', date, timezoneIana);
  const { data, error } = await query.order('CreatedAt', { ascending: false });
  if (error) throw error;
  return filterFoodRowsByCalendarDay(data || [], date, timezoneIana, 'CreatedAt');
}

/**
 * Lightweight day totals — no AnalysisData / images (calorie trend, charts).
 */
export async function fetchMealTotalsForDate(userId, date, timezoneIana = IANA_IST) {
  const supabase = getSupabaseClient();
  let query = supabase
    .from('food_nutrition_data_table')
    .select([
      'TotalCalories, TotalProtein, TotalCarbs, TotalFat, TotalFiber',
      'TotalSugar, TotalSodium, TotalCholesterol',
      'TotalVitaminA, TotalVitaminC, TotalVitaminD, TotalVitaminE, TotalVitaminK',
      'TotalVitaminB1, TotalVitaminB2, TotalVitaminB3, TotalVitaminB6, TotalVitaminB9, TotalVitaminB12',
      'TotalCalcium, TotalIron, TotalMagnesium, TotalPotassium, TotalZinc, TotalPhosphorus',
      'CreatedAt',
    ].join(', '))
    .eq('UserID', String(userId))
    .eq('IsDeleted', 0)
    .not('AnalysisData', 'is', null);
  query = applyDayFilterWidened(query, 'CreatedAt', date, timezoneIana);
  const { data, error } = await query;
  if (error) throw error;
  return filterFoodRowsByCalendarDay(data || [], date, timezoneIana, 'CreatedAt');
}

/** Image bytes only — for lazy thumbnails / detail modal (keeps list payloads small). */
export async function getMealImageById(userId, id) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('food_nutrition_data_table')
    .select('ID, ImageBase64, ImagePath')
    .eq('ID', id)
    .eq('UserID', String(userId))
    .eq('IsDeleted', 0)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function getStatsCounts(userId, timezoneIana = IANA_IST) {
  const supabase = getSupabaseClient();
  const todayYmd = todayInTimezone(timezoneIana);
  const weekAgoYmd = shiftDateYmd(todayYmd, -7, timezoneIana);

  const [totalR, todayR, weekR, bgR, weeklyR, recentR] = await Promise.all([
    supabase.from('food_nutrition_data_table').select('*', { count: 'exact', head: true })
      .eq('UserID', userId).eq('IsDeleted', 0),
    applySinceDayStartFilter(
      supabase.from('food_nutrition_data_table').select('*', { count: 'exact', head: true })
        .eq('UserID', userId).eq('IsDeleted', 0),
      'CreatedAt',
      todayYmd,
      timezoneIana,
    ),
    applySinceDayStartFilter(
      supabase.from('food_nutrition_data_table').select('*', { count: 'exact', head: true })
        .eq('UserID', userId).eq('IsDeleted', 0),
      'CreatedAt',
      weekAgoYmd,
      timezoneIana,
    ),
    supabase.from('food_nutrition_data_table').select('*', { count: 'exact', head: true })
      .eq('UserID', userId).eq('ProcessedBy', 'background_service').eq('IsDeleted', 0),
    applySinceDayStartFilter(
      supabase.from('food_nutrition_data_table')
        .select('TotalCalories, TotalProtein, TotalCarbs, TotalFat, TotalFiber, CreatedAt')
        .eq('UserID', userId).eq('IsDeleted', 0),
      'CreatedAt',
      weekAgoYmd,
      timezoneIana,
    ),
    supabase.from('food_nutrition_data_table')
      .select('ID, ImagePath, TotalCalories, TotalProtein, TotalCarbs, TotalFat, ProcessedBy, CreatedAt')
      .eq('UserID', userId).eq('IsDeleted', 0).order('CreatedAt', { ascending: false }).limit(10),
  ]);
  for (const r of [totalR, todayR, weekR, bgR, weeklyR, recentR]) {
    if (r.error) throw r.error;
  }
  return {
    totalCount: totalR.count || 0,
    todayCount: todayR.count || 0,
    weekCount: weekR.count || 0,
    backgroundCount: bgR.count || 0,
    weeklyData: weeklyR.data || [],
    recentAnalyses: recentR.data || [],
  };
}

export async function touchLastActive(userId) {
  if (!userId) return;
  try {
    const supabase = getSupabaseClient();
    await supabase.from('team_table').update({ LastActiveAt: nowUtc() }).eq('UserId', userId);
  } catch (_) { /* ignore */ }
}
