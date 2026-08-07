/**
 * Glycemic-index helpers for meal edit persistence.
 * GI is intrinsic to the food — portion edits must never wipe it.
 * Meal GI uses available-carb weighted average (never sum of item GIs).
 */

import { computeMealGlycemicIndex } from './mealGlycemicIndex.js';

/**
 * Resolve glycemic index from food items (preferred) or analysisData.total.
 * Prefer recomputing from foods so legacy summed totals are healed.
 * @param {object} analysisData
 * @returns {number|null}
 */
export function extractGlycemicIndexFromAnalysisData(analysisData) {
  const foods = Array.isArray(analysisData?.foods) ? analysisData.foods : [];
  if (foods.length > 0) {
    const fromFoods = computeMealGlycemicIndex(foods);
    if (fromFoods != null) return fromFoods;
  }
  const totalGi = analysisData?.total?.glycemic_index;
  if (totalGi != null && Number.isFinite(Number(totalGi))) {
    return Math.round(Number(totalGi));
  }
  return null;
}

/**
 * Ensure AnalysisData.total keeps GI. Does not overwrite per-food GI values.
 * @param {object} analysisData
 * @param {number} gi
 * @returns {object}
 */
export function injectGlycemicIndexIntoAnalysisData(analysisData, gi) {
  if (!analysisData || gi == null) return analysisData;
  const next = { ...analysisData };
  if (next.total && typeof next.total === 'object') {
    next.total = { ...next.total, glycemic_index: gi };
  } else {
    next.total = { ...(next.total || {}), glycemic_index: gi };
  }
  return next;
}

/**
 * Resolve GI for an update: client body → AnalysisData → existing DB column.
 * When AnalysisData has foods, extract prefers available-carb weighted recompute.
 * @param {{ glycemicIndex?: number|null, analysisData?: object, existingGlycemicIndex?: number|null }} input
 * @returns {{ resolvedGi: number|null, source: 'client'|'analysisData'|'existing'|'none' }}
 */
export function resolveGlycemicIndexForUpdate({
  glycemicIndex,
  analysisData,
  existingGlycemicIndex,
}) {
  // Prefer recomputing from foods whenever possible (correct formula).
  // Client top-level GI may still be a legacy sum — only trust it when foods
  // cannot produce a meal GI.
  const fromData = extractGlycemicIndexFromAnalysisData(analysisData);
  if (fromData != null) {
    return { resolvedGi: fromData, source: 'analysisData' };
  }
  if (glycemicIndex != null && Number.isFinite(Number(glycemicIndex))) {
    return { resolvedGi: Math.round(Number(glycemicIndex)), source: 'client' };
  }
  if (existingGlycemicIndex != null && Number.isFinite(Number(existingGlycemicIndex))) {
    return {
      resolvedGi: Math.round(Number(existingGlycemicIndex)),
      source: 'existing',
    };
  }
  return { resolvedGi: null, source: 'none' };
}
