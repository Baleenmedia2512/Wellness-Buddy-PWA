import { getSupabaseClient, getISTTimestamp } from '../../utils/supabaseClient.js';

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

export async function fetchMealsForDate(userId, date) {
  const supabase = getSupabaseClient();
  const startOfDay = `${date}T00:00:00`;
  const endOfDay = `${date}T23:59:59`;
  const { data, error } = await supabase
    .from('food_nutrition_data_table')
    .select('ID, ImagePath, ImageBase64, AnalysisData, ConfidenceScore, TotalCalories, TotalProtein, TotalCarbs, TotalFat, TotalFiber, TotalSugar, TotalSodium, TotalCholesterol, GlycemicIndex, ProcessedBy, DeviceInfo, CreatedAt')
    .eq('UserID', String(userId))
    .eq('IsDeleted', 0)
    // PR 6 — defensive: exclude rows whose AnalysisData never landed (failed
    // mid-write, or — pre-PR-6 — speculative pending-capture orphans left
    // behind when the capture turned out to be weight/education/smartwatch).
    // Matches the same predicate already enforced by `listAnalyses`.
    .not('AnalysisData', 'is', null)
    .gte('CreatedAt', startOfDay)
    .lte('CreatedAt', endOfDay)
    .order('CreatedAt', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getStatsCounts(userId) {
  const supabase = getSupabaseClient();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7);

  const [totalR, todayR, weekR, bgR, weeklyR, recentR] = await Promise.all([
    supabase.from('food_nutrition_data_table').select('*', { count: 'exact', head: true })
      .eq('UserID', userId).eq('IsDeleted', 0),
    supabase.from('food_nutrition_data_table').select('*', { count: 'exact', head: true })
      .eq('UserID', userId).eq('IsDeleted', 0).gte('CreatedAt', today.toISOString()),
    supabase.from('food_nutrition_data_table').select('*', { count: 'exact', head: true })
      .eq('UserID', userId).eq('IsDeleted', 0).gte('CreatedAt', weekAgo.toISOString()),
    supabase.from('food_nutrition_data_table').select('*', { count: 'exact', head: true })
      .eq('UserID', userId).eq('ProcessedBy', 'background_service').eq('IsDeleted', 0),
    supabase.from('food_nutrition_data_table')
      .select('TotalCalories, TotalProtein, TotalCarbs, TotalFat, TotalFiber, CreatedAt')
      .eq('UserID', userId).eq('IsDeleted', 0).gte('CreatedAt', weekAgo.toISOString()),
    supabase.from('food_nutrition_data_table')
      .select('ID, ImagePath, ImageBase64, TotalCalories, TotalProtein, TotalCarbs, TotalFat, ProcessedBy, CreatedAt')
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
    await supabase.from('team_table').update({ LastActiveAt: getISTTimestamp() }).eq('UserId', userId);
  } catch (_) { /* ignore */ }
}

export { getISTTimestamp };
