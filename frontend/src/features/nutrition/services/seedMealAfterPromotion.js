import { buildMealRowFromAnalysis, extractMealIdFromPromotionResult } from './buildMealFromAnalysis.js';
import { seedMealDetail } from './mealDetailCache.js';

/**
 * Seed meal detail cache after manual/AI food save so first tap is instant.
 *
 * @param {Object} params
 * @param {string} params.ownerUserId
 * @param {object} params.result promoteUnknownToFood / save() response
 * @param {object|string} params.analysisResult
 * @param {string} [params.capturedAt]
 * @param {object} [params.totals]
 * @param {string|null} [params.processedBy]
 * @param {string|null} [params.imagePath]
 * @returns {object|null} seeded meal row
 */
export function seedMealAfterPromotion({
  ownerUserId,
  result,
  analysisResult,
  capturedAt = null,
  totals = null,
  processedBy = null,
  imagePath = null,
}) {
  const mealId = extractMealIdFromPromotionResult(result);
  if (!ownerUserId || !mealId || analysisResult == null) return null;
  const meal = buildMealRowFromAnalysis({
    mealId,
    analysisResult,
    capturedAt,
    totals,
    processedBy,
    imagePath,
  });
  seedMealDetail(ownerUserId, meal);
  return meal;
}
