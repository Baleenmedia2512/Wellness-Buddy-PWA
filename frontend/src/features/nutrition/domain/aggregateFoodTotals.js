// Pure helper: sum the 8 nutrition macros across a list of food items.
//
// Each food may expose values either as `food.nutrition.<field>` (canonical
// AI shape) or as `food.<field>` (flattened shape used by some upstream
// auto-correction paths). Both are accepted; nested takes precedence so
// callers can override the per-food block without surprises.
//
// Critical: the eight macros must include `sugar`, `sodium`, and
// `cholesterol`. Dropping any of them here causes the downstream save
// payload to lose the values entirely, persisting NULL in
// `food_nutrition_data_table.TotalSugar / TotalSodium / TotalCholesterol`.
// See PR fix(nutrition): persist sugar/sodium/cholesterol from AI analysis.

import { computeMealGlycemicIndex } from './mealGlycemicIndex';

export const FOOD_TOTAL_FIELDS = Object.freeze([
  'calories',
  'protein',
  'carbs',
  'fat',
  'fiber',
  'sugar',
  'sodium',
  'cholesterol',
]);

// Vitamins + minerals are also summed across foods (same as macros). Keep in
// sync with NUTRITION_REQUIRED in geminiService.js and MICRO_FIELDS in
// backend/features/background-analysis/analysis.service.js. Without summing
// these here, the per-food enrichment is correct but the dashboard `total`
// stays at 0 and the DB stores NULL for every vitamin/mineral.
export const FOOD_MICRO_FIELDS = Object.freeze([
  'vitamin_a', 'vitamin_c', 'vitamin_d', 'vitamin_e', 'vitamin_k',
  'vitamin_b1', 'vitamin_b2', 'vitamin_b3', 'vitamin_b6', 'vitamin_b9', 'vitamin_b12',
  'calcium', 'iron', 'magnesium', 'potassium', 'zinc', 'phosphorus',
]);

/** AI JSON key → PUT body key → meal table column (keep in sync with dailyStatsRules). */
export const MICRO_PERSIST_FIELDS = Object.freeze([
  { aiKey: 'vitamin_a', apiKey: 'totalVitaminA', dbCol: 'TotalVitaminA' },
  { aiKey: 'vitamin_c', apiKey: 'totalVitaminC', dbCol: 'TotalVitaminC' },
  { aiKey: 'vitamin_d', apiKey: 'totalVitaminD', dbCol: 'TotalVitaminD' },
  { aiKey: 'vitamin_e', apiKey: 'totalVitaminE', dbCol: 'TotalVitaminE' },
  { aiKey: 'vitamin_k', apiKey: 'totalVitaminK', dbCol: 'TotalVitaminK' },
  { aiKey: 'vitamin_b1', apiKey: 'totalVitaminB1', dbCol: 'TotalVitaminB1' },
  { aiKey: 'vitamin_b2', apiKey: 'totalVitaminB2', dbCol: 'TotalVitaminB2' },
  { aiKey: 'vitamin_b3', apiKey: 'totalVitaminB3', dbCol: 'TotalVitaminB3' },
  { aiKey: 'vitamin_b6', apiKey: 'totalVitaminB6', dbCol: 'TotalVitaminB6' },
  { aiKey: 'vitamin_b9', apiKey: 'totalVitaminB9', dbCol: 'TotalVitaminB9' },
  { aiKey: 'vitamin_b12', apiKey: 'totalVitaminB12', dbCol: 'TotalVitaminB12' },
  { aiKey: 'calcium', apiKey: 'totalCalcium', dbCol: 'TotalCalcium' },
  { aiKey: 'iron', apiKey: 'totalIron', dbCol: 'TotalIron' },
  { aiKey: 'magnesium', apiKey: 'totalMagnesium', dbCol: 'TotalMagnesium' },
  { aiKey: 'potassium', apiKey: 'totalPotassium', dbCol: 'TotalPotassium' },
  { aiKey: 'zinc', apiKey: 'totalZinc', dbCol: 'TotalZinc' },
  { aiKey: 'phosphorus', apiKey: 'totalPhosphorus', dbCol: 'TotalPhosphorus' },
]);

const ALL_SUMMABLE_FIELDS = Object.freeze([...FOOD_TOTAL_FIELDS, ...FOOD_MICRO_FIELDS]);

const pick = (food, field) => {
  const nested = food?.nutrition?.[field];
  if (nested != null) return Number(nested) || 0;
  const flat = food?.[field];
  if (flat != null) return Number(flat) || 0;
  return 0;
};

export function aggregateFoodTotals(foods) {
  const seed = ALL_SUMMABLE_FIELDS.reduce((acc, f) => ({ ...acc, [f]: 0 }), {});
  if (!Array.isArray(foods)) return { ...seed, glycemicIndex: null };
  const totals = foods.reduce((acc, food) => {
    ALL_SUMMABLE_FIELDS.forEach((field) => {
      acc[field] += pick(food, field);
    });
    return acc;
  }, seed);

  // Round micros to 2 decimals to avoid floating-point noise reaching the UI.
  FOOD_MICRO_FIELDS.forEach((f) => {
    totals[f] = Math.round(totals[f] * 100) / 100;
  });

  // Meal GI = Σ(GI × available carbs) / Σ(available carbs) — never sum/simple-average
  const glycemicIndex = computeMealGlycemicIndex(foods);

  return { ...totals, glycemicIndex };
}
