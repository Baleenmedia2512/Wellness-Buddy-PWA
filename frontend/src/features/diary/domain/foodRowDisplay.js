/**
 * diary/domain/foodRowDisplay.js
 *
 * Presentational values for food-subtyped diary rows (water / afresh / shake / food).
 * Pure — zero I/O.
 */

import {
  DIARY_FOOD_ACTIVITY,
  extractFoodItemDisplayNames,
  extractScoops,
  extractShakeProducts,
  extractShakeServings,
  extractVolumeMl,
  resolveFoodActivityType,
  shouldShowMealBadge,
} from './activityType';
import { formatWaterVolume } from './formatVolume';
import { buildDiaryShareSuffix } from './share/suffixes';
import { formatShakeProductScoops } from './share/shakeShare';

const ACTIVITY_THUMB = Object.freeze({
  [DIARY_FOOD_ACTIVITY.WATER]: '💧',
  [DIARY_FOOD_ACTIVITY.AFRESH]: '🥤',
  [DIARY_FOOD_ACTIVITY.SHAKE]: '🥤',
  [DIARY_FOOD_ACTIVITY.FOOD]: '🍽️',
});

/**
 * @param {{
 *   processedBy?: string|null,
 *   analysisData?: unknown,
 *   foodData?: object,
 *   calories?: number,
 *   mealLabel?: string|null,
 *   glycemicIndex?: number|null,
 * }} input
 */
export function resolveFoodRowPresentation({
  processedBy = null,
  analysisData = null,
  foodData = null,
  calories = 0,
  mealLabel = null,
  glycemicIndex = null,
} = {}) {
  const activityType = resolveFoodActivityType({
    processedBy,
    analysisData,
    foodData,
  });
  const showMealBadge = shouldShowMealBadge(activityType);
  const thumbFallback = ACTIVITY_THUMB[activityType] || ACTIVITY_THUMB.food;
  const volumeMl = extractVolumeMl(foodData, analysisData);
  const scoops = extractScoops(foodData, analysisData);
  const servings = extractShakeServings(foodData, analysisData);
  const shakeProducts = extractShakeProducts(foodData, analysisData);
  const foodName = foodData?.name || 'Food';

  let primaryValue = String(Math.round(Number(calories) || 0));
  let primaryUnit = 'kcal';
  let ariaValue = `${Math.round(Number(calories) || 0)} kilocalories`;
  let secondaryLabel = null;

  if (activityType === DIARY_FOOD_ACTIVITY.WATER) {
    const label = volumeMl != null ? formatWaterVolume(volumeMl) : '—';
    // Split "1 L" / "500 mL" into value + unit for the right-aligned stack.
    const parts = label.match(/^(.+)\s+(L|mL)$/);
    if (parts) {
      primaryValue = parts[1];
      primaryUnit = parts[2];
    } else {
      primaryValue = label;
      primaryUnit = '';
    }
    ariaValue = `consumed ${label}`;
  } else if (activityType === DIARY_FOOD_ACTIVITY.AFRESH) {
    const count = scoops != null ? scoops : 1;
    const kcal = Math.round(
      Number(calories)
      || Number(foodData?.nutrition?.calories)
      || 0,
    );
    primaryValue = String(kcal);
    primaryUnit = 'kcal';
    secondaryLabel = `${count} ${count === 1 ? 'scoop' : 'scoops'}`;
    ariaValue = `${count} ${count === 1 ? 'scoop' : 'scoops'}, ${kcal} kilocalories`;
  } else if (activityType === DIARY_FOOD_ACTIVITY.SHAKE) {
    const scoopLine = formatShakeProductScoops(shakeProducts);
    if (scoopLine) {
      secondaryLabel = scoopLine;
      ariaValue = `${scoopLine}, ${primaryValue} kilocalories`;
    }
  }

  const itemNames = extractFoodItemDisplayNames(foodData, analysisData);
  const shareText = buildFoodActivityShareText({
    activityType,
    mealLabel,
    foodName,
    foodData,
    calories,
    volumeMl,
    scoops,
    servings,
    shakeProducts,
    itemNames,
    glycemicIndex,
  });

  return {
    activityType,
    showMealBadge,
    thumbFallback,
    primaryValue,
    primaryUnit,
    ariaValue,
    volumeMl,
    scoops,
    servings,
    shakeProducts,
    secondaryLabel,
    shareText,
  };
}

/**
 * @param {object} input
 * @returns {string}
 */
export function buildFoodActivityShareText({
  activityType,
  mealLabel = null,
  foodName = 'Food',
  foodData = null,
  calories = 0,
  volumeMl = null,
  scoops = null,
  servings = 1,
  shakeProducts = null,
  itemNames = null,
  glycemicIndex = null,
} = {}) {
  const nutrition = foodData?.nutrition || {};
  switch (activityType) {
    case DIARY_FOOD_ACTIVITY.WATER:
      return buildDiaryShareSuffix('water', { volumeMl, soFarToday: false });
    case DIARY_FOOD_ACTIVITY.AFRESH:
      return buildDiaryShareSuffix('afresh', {
        scoops: scoops ?? 1,
        calories: nutrition.calories ?? calories,
        soFarToday: false,
      });
    case DIARY_FOOD_ACTIVITY.SHAKE:
      return buildDiaryShareSuffix('shake', {
        shakeName: foodName || 'Protein Shake',
        servings,
        shakeProducts: shakeProducts || extractShakeProducts(foodData),
      });
    default:
      return buildDiaryShareSuffix('food', {
        foodName,
        itemNames: itemNames || extractFoodItemDisplayNames(foodData),
        calories: nutrition.calories ?? calories,
        protein: nutrition.protein ?? 0,
        carbs: nutrition.carbs ?? 0,
        fat: nutrition.fat ?? 0,
        fiber: nutrition.fiber ?? 0,
        glycemicIndex: glycemicIndex ?? nutrition.glycemic_index ?? null,
      });
  }
}
