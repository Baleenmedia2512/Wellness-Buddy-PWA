// Convert a DB-format detailed food item into the shape EditableFoodItem expects.
// Used by the analysis-edit hook when (re)loading a selected meal.

const LIQUID_KEYWORDS = [
  'shake', 'juice', 'milk', 'lassi', 'coffee', 'tea', 'water', 'smoothie',
  'soup', 'drink', 'beverage', 'cola', 'soda', 'beer', 'wine', 'cocktail',
  'latte', 'cappuccino', 'espresso',
];

const isLiquidByName = (name) => {
  const lower = (name || '').toLowerCase();
  return LIQUID_KEYWORDS.some((kw) => lower.includes(kw));
};

const detectIsLiquid = (item) =>
  item.isLiquid === true ||
  (item.volume_ml !== null && item.volume_ml !== undefined) ||
  isLiquidByName(item.name);

const buildPer100g = (nutrition, actualGrams) => ({
  calories: (nutrition.calories || 0) * (100 / actualGrams),
  protein:  (nutrition.protein  || 0) * (100 / actualGrams),
  carbs:    (nutrition.carbs    || 0) * (100 / actualGrams),
  fat:      (nutrition.fat      || 0) * (100 / actualGrams),
  fiber:    (nutrition.fiber    || 0) * (100 / actualGrams),
});

/**
 * @param {object} item    DB-format food item
 * @param {boolean} withPer100g  include per100g (true for full transform, false for cancel-edit reset)
 */
export function transformDbItemToEditable(item, withPer100g = true) {
  const isLiquid = detectIsLiquid(item);
  const actualGrams = isLiquid
    ? (item.volume_ml || item.grams || item.weight_g || 100)
    : (item.weight_g || item.grams || item.volume_ml || 100);
  const unit = item.unit || (isLiquid ? 'ml' : 'g');

  const base = {
    name: item.name,
    nutrition: item.nutrition,
    weight_g: item.weight_g,
    volume_ml: item.volume_ml,
    portion: item.portion,
    serving: {
      description: item.portion,
      grams: actualGrams,
      unit,
      isLiquid,
    },
    portionDescription: item.portion,
    grams: actualGrams,
    unit,
    isLiquid,
    // Preserve correction metadata so reverse-lookup stays accurate.
    originalAiName: item.originalAiName || null,
    wasAutoCorrected: item.wasAutoCorrected || (item.originalAiName ? true : false),
    correctionSource: item.correctionSource || null,
    correctionMetadata: item.correctionMetadata || null,
    needsReverseLookup: !item.originalAiName && !item.correctionMetadata,
  };

  if (withPer100g) {
    base.per100g = item.per100g || buildPer100g(item.nutrition || {}, actualGrams);
  }
  return base;
}
