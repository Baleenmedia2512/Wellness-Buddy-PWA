/**
 * Build a meal row shape (NutritionDashboard-compatible) from in-memory analysis.
 * Used to seed the meal detail cache immediately after manual/AI save.
 */

function pickTotal(analysisResult) {
  if (!analysisResult || typeof analysisResult !== 'object') return {};
  if (analysisResult.total && typeof analysisResult.total === 'object') {
    return analysisResult.total;
  }
  const foods = Array.isArray(analysisResult.foods) ? analysisResult.foods : [];
  if (foods.length === 1 && foods[0]?.nutrition) return foods[0].nutrition;
  return {};
}

/**
 * @param {Object} params
 * @param {string|number} params.mealId
 * @param {Object|string} params.analysisResult
 * @param {string} [params.capturedAt]
 * @param {object} [params.totals] Diary list totals override
 * @param {string|null} [params.processedBy]
 * @param {string|null} [params.imagePath]
 * @param {number|null} [params.confidence]
 * @returns {object}
 */
export function buildMealRowFromAnalysis({
  mealId,
  analysisResult,
  capturedAt = null,
  totals = null,
  processedBy = null,
  imagePath = null,
  confidence = null,
}) {
  const analysisData = typeof analysisResult === 'string'
    ? analysisResult
    : JSON.stringify(analysisResult);
  const total = pickTotal(
    typeof analysisResult === 'string' ? JSON.parse(analysisResult) : analysisResult,
  );
  const t = totals || {};
  return {
    ID: mealId,
    AnalysisData: analysisData,
    ImagePath: imagePath ?? null,
    TotalCalories: t.calories ?? total.calories ?? null,
    TotalProtein: t.protein ?? total.protein ?? null,
    TotalCarbs: t.carbs ?? total.carbs ?? null,
    TotalFat: t.fat ?? total.fat ?? null,
    TotalFiber: t.fiber ?? total.fiber ?? null,
    TotalSugar: t.sugar ?? total.sugar ?? null,
    TotalSodium: t.sodium ?? total.sodium ?? null,
    TotalCholesterol: t.cholesterol ?? total.cholesterol ?? null,
    GlycemicIndex: t.glycemicIndex ?? total.glycemic_index ?? total.glycemicIndex ?? null,
    ConfidenceScore: confidence ?? null,
    CreatedAt: capturedAt ?? null,
    ProcessedBy: processedBy ?? null,
  };
}

/**
 * Extract meal id from promoteUnknownToFood / save() response envelope.
 * @param {object|null|undefined} result
 * @returns {string|null}
 */
export function extractMealIdFromPromotionResult(result) {
  if (!result) return null;
  const id = result.id ?? result.data?.id ?? result.mealId ?? null;
  return id != null && id !== '' ? String(id) : null;
}
