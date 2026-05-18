/**
 * backend/features/water/domain/intake.rules.js
 * ---------------------------------------------------------------------------
 * PURE business rules for daily water intake.
 *
 * Per claude.md §2.2 / §3.1, this module must not import axios, fetch, pg,
 * supabase, react, next/*, or read process.env. Inputs come from the data
 * layer; outputs are returned as plain objects.
 *
 * Reference implementation for Vertical Slice Architecture. Copy this shape
 * when extracting other features.
 * ---------------------------------------------------------------------------
 */
import {
  isExemptedBeverageOnly,
  isExemptedFood,
} from '../../../utils/foodTypeDetection.js';

/** Default daily requirement (ml) when user has no recorded weight. */
export const DEFAULT_REQUIRED_ML = 2500;

/** ml of water required per kg of body weight per day (× 1000). */
const ML_PER_KG = 1000 / 20; // 50 ml / kg

/**
 * Compute the required daily intake (ml) given a latest weight in kg.
 * Returns DEFAULT_REQUIRED_ML when weight is missing or invalid.
 *
 * @param {number|string|null|undefined} weightKgRaw
 * @returns {{ requiredMl: number, weightKg: number|null, defaultWeight: boolean }}
 */
export function computeRequiredMl(weightKgRaw) {
  const weightKg = parseFloat(weightKgRaw);
  const hasWeight = Number.isFinite(weightKg) && weightKg > 0;
  return {
    weightKg: hasWeight ? weightKg : null,
    defaultWeight: !hasWeight,
    requiredMl: hasWeight ? Math.round(weightKg * ML_PER_KG) : DEFAULT_REQUIRED_ML,
  };
}

/**
 * Safely parse the AnalysisData column, which may be a JSON string or an
 * already-decoded object. Returns null if the value is unusable.
 *
 * @param {unknown} value
 * @returns {{ foods?: Array<{ name: string, volume_ml?: number|string, weight_g?: number|string, estimatedWeight?: number|string }> }|null}
 */
export function parseAnalysisData(value) {
  if (value == null) return null;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/**
 * Sum the ml of water-exempted foods inside one food record.
 *
 * @param {{ CreatedAt: string, AnalysisData: unknown }} record
 * @returns {{ recordMl: number, items: Array<{ name: string, volumeMl: number }> }}
 */
export function extractWaterFromRecord(record) {
  const ad = parseAnalysisData(record.AnalysisData);
  const foods = Array.isArray(ad?.foods) ? ad.foods : [];
  let recordMl = 0;
  const items = [];
  for (const food of foods) {
    if (!isExemptedFood(food?.name)) continue;
    const ml =
      parseFloat(food.volume_ml) ||
      parseFloat(food.weight_g) ||
      parseFloat(food.estimatedWeight) ||
      0;
    if (ml > 0) {
      recordMl += ml;
      items.push({ name: food.name, volumeMl: ml });
    }
  }
  return { recordMl, items };
}

/**
 * Aggregate a list of food records into the daily-intake response shape.
 *
 * @param {object} args
 * @param {string|number} args.userId
 * @param {string} args.date              YYYY-MM-DD (already validated)
 * @param {number|string|null} args.latestWeightKg
 * @param {Array<{ CreatedAt: string, AnalysisData: unknown }>} args.foodRows
 * @returns {{
 *   date: string,
 *   userId: number,
 *   weightKg: number|null,
 *   defaultWeight: boolean,
 *   requiredMl: number,
 *   totalMl: number,
 *   remainingMl: number,
 *   achieved: boolean,
 *   progressPercent: number,
 *   logCount: number,
 *   logs: Array<{ loggedAt: string, volumeMl: number, items: Array<{ name: string, volumeMl: number }> }>,
 * }}
 */
export function computeDailyIntake({ userId, date, latestWeightKg, foodRows }) {
  const { weightKg, defaultWeight, requiredMl } = computeRequiredMl(latestWeightKg);

  const waterRecords = (foodRows || []).filter((r) =>
    isExemptedBeverageOnly(r?.AnalysisData),
  );

  let totalMl = 0;
  const logs = [];
  for (const record of waterRecords) {
    const { recordMl, items } = extractWaterFromRecord(record);
    if (recordMl > 0) {
      totalMl += recordMl;
      logs.push({
        loggedAt: record.CreatedAt,
        volumeMl: Math.round(recordMl),
        items,
      });
    }
  }

  const totalRounded = Math.round(totalMl);
  const remainingMl = Math.max(0, requiredMl - totalRounded);
  const achieved = totalRounded >= requiredMl;
  const progressPercent =
    requiredMl > 0 ? Math.min(100, Math.round((totalRounded / requiredMl) * 100)) : 0;

  return {
    date,
    userId: parseInt(userId, 10),
    weightKg,
    defaultWeight,
    requiredMl,
    totalMl: totalRounded,
    remainingMl,
    achieved,
    progressPercent,
    logCount: logs.length,
    logs,
  };
}
