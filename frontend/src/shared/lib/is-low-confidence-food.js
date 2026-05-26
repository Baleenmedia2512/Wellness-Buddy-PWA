/**
 * frontend/src/shared/lib/is-low-confidence-food.js
 * ---------------------------------------------------------------------------
 * Pure predicate that decides whether a Gemini image-type detection result
 * is REALLY a confident food classification, or whether the detector quietly
 * defaulted to 'food' because it had no better answer.
 *
 * Background: `frontend/src/shared/services/imageTypeDetector.js` returns
 * `{ type: 'food', confidence: 0.3, details: { defaulted: true } }` (line
 * 507/510) whenever the unified Gemini call fails or returns nothing usable.
 * The same path also fires for any random photo (phone, cat, whiteboard,
 * etc.) — Gemini emits `type: 'food'` with `foods: []` and total.calories: 0.
 *
 * Before PR 3 these images silently saved into `food_nutrition_data_table`
 * as "Unknown Food / 0 kcal" rows that polluted the user's nutrition feed
 * and produced broken share links. This predicate is the gate that routes
 * them into the disambiguation modal instead.
 *
 * Pure: no imports beyond constants, no side effects, deterministic.
 * ---------------------------------------------------------------------------
 */

import { IMAGE_TYPE_FOOD } from '../constants/imageTypes.js';

const MIN_FOOD_CONFIDENCE = 0.4;

/**
 * @param {object|null|undefined} detectorResult — shape returned by
 *        `imageTypeDetector.detectImageType()`.
 * @returns {boolean} true when the result is shaped like food but should
 *                    NOT be auto-saved without user confirmation.
 */
export function isLowConfidenceFood(detectorResult) {
  // No result at all => definitely uncertain.
  if (!detectorResult) return true;

  // Only food-typed results are candidates — weight/education/smartwatch
  // each have their own confidence thresholds upstream.
  if (detectorResult.type !== IMAGE_TYPE_FOOD) return false;

  const details = detectorResult.details || {};

  // Explicit "defaulted on error" marker from imageTypeDetector.
  if (details.defaulted === true) return true;

  const confidence = typeof detectorResult.confidence === 'number'
    ? detectorResult.confidence
    : 0;
  if (confidence < MIN_FOOD_CONFIDENCE) return true;

  // Empty food list -> nothing to save.
  const foods = Array.isArray(details.foods) ? details.foods : [];
  if (foods.length === 0) return true;

  // Foods listed but zero calories across the board -> Gemini hallucinated
  // names without nutrition. Treat as uncertain.
  const totalCalories = Number(details.total?.calories) || 0;
  if (totalCalories === 0) return true;

  return false;
}

export const __test__ = { MIN_FOOD_CONFIDENCE };
