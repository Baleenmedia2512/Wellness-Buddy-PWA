/**
 * GET /api/get-water-intake
 * Returns today's water intake for a user, the required amount based on body weight,
 * and whether the water intake discipline has been achieved.
 *
 * Formula: requiredMl = (latestWeightKg / 20) * 1000
 * Uses most recent weight from any date — no need to upload weight today
 * Default when no weight has EVER been logged: 2500 ml (2.5 L)
 *
 * Query params:
 *   userId  - User ID (required)
 *   date    - Date string YYYY-MM-DD (optional, defaults to today IST)
 */

import { getSupabaseClient } from '../../utils/supabaseClient.js';
import { isExemptedBeverageOnly, isExemptedFood } from '../../utils/foodTypeDetection.js';

const DEFAULT_REQUIRED_ML = 2500; // 2.5 L default when no weight recorded

function todayIST() {
  // IST = UTC+5:30
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + istOffset);
  return ist.toISOString().split('T')[0];
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, date } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  const targetDate = date || todayIST();

  try {
    const supabase = getSupabaseClient();

    // ── 1. Fetch latest weight for the user from ANY date (no date restriction) ─
    // Uses most recent weight ever recorded — no need to upload weight today
    // Falls back to DEFAULT_REQUIRED_ML (2500ml) ONLY if zero weight records exist
    const { data: weightRows, error: weightError } = await supabase
      .from('weight_records_table')
      .select('Weight, CreatedAt')
      .eq('UserId', userId)
      .or('IsDeleted.is.null,IsDeleted.eq.0,IsDeleted.eq.false')
      .order('CreatedAt', { ascending: false })
      .limit(1);

    if (weightError) {
      console.error('❌ [get-water-intake] Weight query error:', weightError);
    }

    const latestWeight = weightRows && weightRows.length > 0 ? parseFloat(weightRows[0].Weight) : null;
    const hasWeight = latestWeight !== null && !isNaN(latestWeight) && latestWeight > 0;
    const requiredMl = hasWeight
      ? Math.round((latestWeight / 20) * 1000)
      : DEFAULT_REQUIRED_ML;

    // ── 2. Fetch water food records for the target date ──────────────────────
    const { data: foodRows, error: foodError } = await supabase
      .from('food_nutrition_data_table')
      .select('CreatedAt, AnalysisData')
      .eq('UserID', String(userId))
      .or('IsDeleted.is.null,IsDeleted.eq.0')
      .gte('CreatedAt', `${targetDate}T00:00:00`)
      .lte('CreatedAt', `${targetDate}T23:59:59`);

    if (foodError) {
      console.error('❌ [get-water-intake] Food query error:', foodError);
    }

    // ── 3. Filter to water/beverage-only entries and sum volume_ml ───────────
    const waterRecords = (foodRows || []).filter(r => isExemptedBeverageOnly(r.AnalysisData));

    let totalMl = 0;
    const logs = [];

    waterRecords.forEach(record => {
      try {
        const analysisData =
          typeof record.AnalysisData === 'string'
            ? JSON.parse(record.AnalysisData)
            : record.AnalysisData;

        const foods = analysisData?.foods || [];
        let recordMl = 0;

        foods.forEach(food => {
          if (isExemptedFood(food.name)) {
            // Prefer volume_ml, fall back to weight_g (water 1g ≈ 1ml), then estimatedWeight
            const ml = parseFloat(food.volume_ml) || parseFloat(food.weight_g) || parseFloat(food.estimatedWeight) || 0;
            recordMl += ml;
            totalMl += ml;
          }
        });

        if (recordMl > 0) {
          logs.push({
            loggedAt: record.CreatedAt,
            volumeMl: recordMl,
            items: foods
              .filter(f => isExemptedFood(f.name))
              .map(f => ({ name: f.name, volumeMl: parseFloat(f.volume_ml) || 0 })),
          });
        }
      } catch (parseErr) {
        console.warn('⚠️ [get-water-intake] AnalysisData parse error:', parseErr.message);
      }
    });

    const remainingMl = Math.max(0, requiredMl - totalMl);
    const achieved = totalMl >= requiredMl;

    return res.status(200).json({
      date: targetDate,
      userId: parseInt(userId, 10),
      weightKg: hasWeight ? latestWeight : null,
      defaultWeight: !hasWeight,
      requiredMl,
      totalMl: Math.round(totalMl),
      remainingMl: Math.round(remainingMl),
      achieved,
      progressPercent: Math.min(100, Math.round((totalMl / requiredMl) * 100)),
      logCount: logs.length,
      logs,
    });
  } catch (err) {
    console.error('❌ [get-water-intake] Unexpected error:', err);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}
