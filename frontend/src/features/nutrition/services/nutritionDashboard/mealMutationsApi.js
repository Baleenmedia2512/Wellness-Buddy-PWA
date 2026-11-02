// Per-meal write endpoints: nutrition update, delete, undo-delete.

import { pickNutrition } from '../../domain/nutritionFields';
import {
  FOOD_MICRO_FIELDS,
  MICRO_PERSIST_FIELDS,
} from '../../domain/aggregateFoodTotals';

const round = (n) => Math.round(n || 0);
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

function itemNutritionPayload(item) {
  const n = pickNutrition(item.nutrition || item);
  const gi = n.glycemic_index ?? item.glycemic_index ?? item.nutrition?.glycemic_index ?? null;
  const nutrition = {
    calories: round(n.calories ?? item.calories),
    protein: round(n.protein ?? item.protein),
    carbs: round(n.carbs ?? item.carbs),
    fat: round(n.fat ?? item.fat),
    fiber: round(n.fiber ?? item.fiber),
    sugar: round(n.sugar ?? item.sugar ?? 0),
    sodium: round(n.sodium ?? item.sodium ?? 0),
    cholesterol: round(n.cholesterol ?? item.cholesterol ?? 0),
    glycemic_index: gi != null && Number.isFinite(Number(gi)) ? Math.round(Number(gi)) : null,
  };
  for (const key of FOOD_MICRO_FIELDS) {
    const v = n[key] ?? item.nutrition?.[key] ?? item[key];
    if (v != null && v !== '') nutrition[key] = round2(v);
  }
  return nutrition;
}

function totalsNutritionPayload(newTotals) {
  const total = {
    calories: round(newTotals.calories),
    protein: round(newTotals.protein),
    carbs: round(newTotals.carbs),
    fat: round(newTotals.fat),
    fiber: round(newTotals.fiber),
    sugar: round(newTotals.sugar ?? 0),
    sodium: round(newTotals.sodium ?? 0),
    cholesterol: round(newTotals.cholesterol ?? 0),
    glycemic_index: newTotals.glycemic_index ?? null,
  };
  for (const key of FOOD_MICRO_FIELDS) {
    if (newTotals[key] != null) total[key] = round2(newTotals[key]);
  }
  return total;
}

function microApiTotals(newTotals) {
  const out = {};
  for (const { aiKey, apiKey } of MICRO_PERSIST_FIELDS) {
    if (newTotals[aiKey] != null) out[apiKey] = round2(newTotals[aiKey]);
  }
  return out;
}

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
    nutrition: itemNutritionPayload(item),
    originalAiName: item.originalAiName || item.name,
    wasAutoCorrected: item.wasAutoCorrected || false,
    correctionSource: item.correctionSource || null,
    correctionMetadata: item.correctionMetadata || null,
  })),
  total: totalsNutritionPayload(newTotals),
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
      totalCalories:    round(newTotals.calories),
      totalProtein:     round(newTotals.protein),
      totalCarbs:       round(newTotals.carbs),
      totalFat:         round(newTotals.fat),
      totalFiber:       round(newTotals.fiber),
      totalSugar:       round(newTotals.sugar    ?? 0),
      totalSodium:      round(newTotals.sodium   ?? 0),
      totalCholesterol: round(newTotals.cholesterol ?? 0),
      glycemicIndex:    newTotals.glycemic_index ?? null,
      ...microApiTotals(newTotals),
    }),
  });
  const result = await res.json();
  if (!res.ok || !result.success) throw new Error(result.message || 'Failed to update meal');
  // Prefer server AnalysisData — backend may re-inject preserved GlycemicIndex
  const persisted = result.data?.analysisData ?? analysisData;
  if (
    (persisted?.total?.glycemic_index == null) &&
    (newTotals.glycemic_index == null)
  ) {
    console.warn('[updateMealNutrition] glycemic_index missing after meal update', {
      mealId,
    });
  }
  return { result, analysisData: persisted };
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
