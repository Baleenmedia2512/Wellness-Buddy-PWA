// Convert manual-save analysis shape → background-service shape ({ foods, total }).
// Used so all downstream consumers see one canonical structure.

// Keep in sync with `NUTRITION_REQUIRED` in geminiService.js and
// `MICRO_FIELDS` in backend/features/background-analysis/analysis.service.js.
const MICRO_KEYS = [
  'vitamin_a', 'vitamin_c', 'vitamin_d', 'vitamin_e', 'vitamin_k',
  'vitamin_b1', 'vitamin_b2', 'vitamin_b3', 'vitamin_b6', 'vitamin_b9', 'vitamin_b12',
  'calcium', 'iron', 'magnesium', 'potassium', 'zinc', 'phosphorus',
];

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

const pickMicros = (src) => {
  const out = {};
  for (const k of MICRO_KEYS) out[k] = num(src?.[k]);
  return out;
};

const macros = (src) => ({
  calories: src.calories || 0,
  protein: src.protein || 0,
  carbs: src.carbs || 0,
  fat: src.fat || 0,
  fiber: src.fiber || 0,
  sugar: src.sugar || 0,
  sodium: src.sodium || 0,
  cholesterol: src.cholesterol || 0,
  glycemic_index: src.glycemic_index ?? null,
  ...pickMicros(src),
});

const detailedItemToFood = (item) => {
  const n = item.nutrition || {};
  return {
    name: item.name || 'Unknown Food',
    // 🔴 Preserve correction metadata for DB persistence.
    originalAiName: item.originalAiName || item.name,
    wasAutoCorrected: item.wasAutoCorrected || false,
    correctionSource: item.correctionSource || null,
    correctionMetadata: item.correctionMetadata || null,
    portion: item.portionDescription || item.portion || '1 serving',
    weight_g: typeof item.estimatedWeight === 'number' ? item.estimatedWeight : (item.weight_g || 100),
    volume_ml: item.volume_ml || null,
    unit: item.unit || 'g',
    isLiquid: item.isLiquid || false,
    nutrition: {
      calories: item.calories || n.calories || 0,
      protein: item.protein || n.protein || 0,
      carbs: item.carbs || n.carbs || 0,
      fat: item.fat || n.fat || 0,
      fiber: item.fiber || n.fiber || 0,
      sugar: item.sugar || n.sugar || 0,
      sodium: item.sodium || n.sodium || 0,
      cholesterol: item.cholesterol || n.cholesterol || 0,
      glycemic_index: item.glycemic_index ?? n.glycemic_index ?? null,
      // Preserve 17 vitamin/mineral fields. Prefer top-level (set by manual
      // edits) then nested nutrition (set by AI image analysis).
      ...pickMicros({ ...n, ...item }),
    },
  };
};

export function transformToBackgroundServiceFormat(analysisResult) {
  try {
    const { nutrition, detailedItems = [], confidence, category } = analysisResult;
    const foods = detailedItems.length > 0
      ? detailedItems.map(detailedItemToFood)
      : [{
          name: category?.name || 'Unknown Food',
          portion: '1 serving',
          weight_g: 100,
          nutrition: macros(nutrition),
        }];
    return { foods, total: macros(nutrition), confidence: confidence || 'medium' };
  } catch (error) {
    console.error('[transformToBackgroundServiceFormat] Error transforming data:', error);
    return analysisResult;
  }
}
