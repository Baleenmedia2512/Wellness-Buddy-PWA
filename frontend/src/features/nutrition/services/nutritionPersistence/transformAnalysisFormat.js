// Convert manual-save analysis shape → background-service shape ({ foods, total }).
// Used so all downstream consumers see one canonical structure.

const macros = (src) => ({
  calories: src.calories || 0,
  protein: src.protein || 0,
  carbs: src.carbs || 0,
  fat: src.fat || 0,
  fiber: src.fiber || 0,
});

const detailedItemToFood = (item) => ({
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
    calories: item.calories || item.nutrition?.calories || 0,
    protein: item.protein || item.nutrition?.protein || 0,
    carbs: item.carbs || item.nutrition?.carbs || 0,
    fat: item.fat || item.nutrition?.fat || 0,
    fiber: item.fiber || item.nutrition?.fiber || 0,
  },
});

export function transformToBackgroundServiceFormat(analysisResult) {
  try {
    if (!analysisResult) return analysisResult;
    // Already in background-service format.
    if (analysisResult.foods && analysisResult.total) return analysisResult;
    if (!analysisResult.nutrition) return analysisResult; // unknown shape

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
