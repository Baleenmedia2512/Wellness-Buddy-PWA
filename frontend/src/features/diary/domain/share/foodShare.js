/**
 * diary/domain/share/foodShare.js
 * WhatsApp caption for food diary entries.
 */

/**
 * @param {{
 *   mealLabel?: string|null,
 *   foodName?: string|null,
 *   calories?: number|null,
 *   protein?: number|null,
 *   carbs?: number|null,
 *   fat?: number|null,
 *   glycemicIndex?: number|null,
 * }} input
 * @returns {string}
 */
export function buildFoodShareText({
  mealLabel = 'Meal',
  foodName = 'Food',
  calories = 0,
  protein = 0,
  carbs = 0,
  fat = 0,
  glycemicIndex = null,
} = {}) {
  const lines = [
    `🍽️ ${mealLabel || 'Meal'}`,
    '',
    `Food: ${foodName || 'Food'}`,
    '',
    `Calories: ${Math.round(Number(calories) || 0)} kcal`,
    `Protein: ${Math.round(Number(protein) || 0)} g`,
    `Carbs: ${Math.round(Number(carbs) || 0)} g`,
    `Fat: ${Math.round(Number(fat) || 0)} g`,
  ];
  const gi = glycemicIndex != null && Number.isFinite(Number(glycemicIndex))
    ? Math.round(Number(glycemicIndex))
    : null;
  if (gi != null) {
    lines.push(`GI: ${gi}`);
  }
  return lines.join('\n');
}
