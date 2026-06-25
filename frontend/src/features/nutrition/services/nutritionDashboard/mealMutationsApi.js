// Per-meal write endpoints: nutrition update, delete, undo-delete.

const round = (n) => Math.round(n || 0);

const buildAnalysisDataPayload = (newItems, newTotals) => ({
  foods: newItems.map((item) => ({
    name: item.name,
    portion: item.serving?.description || item.portionDescription || item.portion || '1 serving',
    weight_g: item.unit === 'ml'
      ? null
      : (item.serving?.grams || item.grams || item.weight_g || 100),
    volume_ml: item.unit === 'ml'
      ? (item.serving?.grams || item.grams || item.weight_g || 100)
      : null,
    unit: item.unit || item.serving?.unit || 'g',
    isLiquid: item.isLiquid || item.serving?.isLiquid || false,
    nutrition: {
      calories: round(item.nutrition?.calories || item.calories),
      protein:  round(item.nutrition?.protein  || item.protein),
      carbs:    round(item.nutrition?.carbs    || item.carbs),
      fat:      round(item.nutrition?.fat      || item.fat),
      fiber:    round(item.nutrition?.fiber    || item.fiber),
      sugar:    round(item.nutrition?.sugar    ?? item.sugar    ?? 0),
      sodium:   round(item.nutrition?.sodium   ?? item.sodium   ?? 0),
      cholesterol: round(item.nutrition?.cholesterol ?? item.cholesterol ?? 0),
      glycemic_index: item.nutrition?.glycemic_index ?? item.glycemic_index ?? null,
    },
    originalAiName: item.originalAiName || item.name,
    wasAutoCorrected: item.wasAutoCorrected || false,
    correctionSource: item.correctionSource || null,
    correctionMetadata: item.correctionMetadata || null,
  })),
  total: {
    calories: round(newTotals.calories),
    protein:  round(newTotals.protein),
    carbs:    round(newTotals.carbs),
    fat:      round(newTotals.fat),
    fiber:    round(newTotals.fiber),
  },
  confidence: 'high',
});

export async function updateMealNutrition({ apiBaseUrl, mealId, userId, newItems, newTotals }) {
  const analysisData = buildAnalysisDataPayload(newItems, newTotals);
  const res = await fetch(`${apiBaseUrl}/api/food-corrections/nutrition`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: mealId,
      userId,
      analysisData,
      totalCalories: round(newTotals.calories),
      totalProtein:  round(newTotals.protein),
      totalCarbs:    round(newTotals.carbs),
      totalFat:      round(newTotals.fat),
      totalFiber:    round(newTotals.fiber),
    }),
  });
  const result = await res.json();
  if (!res.ok || !result.success) throw new Error(result.message || 'Failed to update meal');
  return { result, analysisData };
}

export async function deleteMealById({ apiBaseUrl, id, userId }) {
  const res = await fetch(`${apiBaseUrl}/api/background-analysis`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, userId }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.message || 'Delete failed');
  return data;
}

export async function undoMealDelete({ apiBaseUrl, id, userId }) {
  const res = await fetch(`${apiBaseUrl}/api/background-analysis/undo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, userId }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.message || 'Undo failed');
  return data;
}
