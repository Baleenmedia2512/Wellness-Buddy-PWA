/**
 * frontend/src/features/nutrition/domain/nutritionFields.js
 * Shared nutrition field list for manual / search scaling (ADR-0005).
 */
import { computeMealGlycemicIndex } from './mealGlycemicIndex';

export const NUTRITION_KEYS = Object.freeze([
  'calories', 'protein', 'carbs', 'fat', 'fiber',
  'sugar', 'sodium', 'cholesterol', 'glycemic_index',
  'vitamin_a', 'vitamin_c', 'vitamin_d', 'vitamin_e', 'vitamin_k',
  'vitamin_b1', 'vitamin_b2', 'vitamin_b3', 'vitamin_b6', 'vitamin_b9', 'vitamin_b12',
  'calcium', 'iron', 'magnesium', 'potassium', 'zinc', 'phosphorus',
]);

/**
 * @param {object|null|undefined} raw
 * @returns {Record<string, number>}
 */
export function pickNutrition(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const key of NUTRITION_KEYS) {
    const v = raw[key] ?? raw.nutrition?.[key];
    if (v == null || v === '') continue;
    const n = Number(v);
    if (Number.isFinite(n)) out[key] = n;
  }
  return out;
}

/**
 * Scale all known nutrition fields by ratio.
 * @param {object} item
 * @param {number} ratio
 */
export function scaleNutritionFields(item, ratio) {
  const base = pickNutrition(item.nutrition || item);
  const out = {};
  for (const [key, value] of Object.entries(base)) {
    // GI is intrinsic to the food — never scale with portion ratio
    if (key === 'glycemic_index') {
      out[key] = Math.round(Number(value));
      continue;
    }
    out[key] = Math.round(Number(value) * ratio * 100) / 100;
  }
  // Keep integer kcal for display consistency with older UI.
  if (out.calories != null) out.calories = Math.round(out.calories);
  return out;
}

/**
 * Sum nutrition objects across items.
 * Glycemic index is NEVER summed — use available-carb weighted meal GI.
 * @param {Array<object>} nutritions
 */
export function sumNutrition(nutritions) {
  const total = {};
  for (const n of nutritions) {
    for (const key of NUTRITION_KEYS) {
      if (key === 'glycemic_index') continue;
      const v = Number(n?.[key]);
      if (!Number.isFinite(v)) continue;
      total[key] = (total[key] || 0) + v;
    }
  }
  if (total.calories != null) total.calories = Math.round(total.calories);
  const mealGi = computeMealGlycemicIndex(
    (nutritions || []).map((n) => ({ nutrition: n })),
  );
  if (mealGi != null) total.glycemic_index = mealGi;
  return total;
}

/**
 * Human-friendly quantity unit for logging (pcs / cups / servings) — not grams.
 * Users say "2 dosa", not "80 g".
 * @param {object} item
 * @returns {{ unit: 'pcs'|'cups'|'servings', shortLabel: string }}
 */
export function resolveQuantityUnit(item) {
  const blob = [
    item?.portion,
    item?.portion_label,
    item?.name,
  ].filter(Boolean).join(' ').toLowerCase();

  if (
    item?.isLiquid
    || item?.is_liquid
    || /\b(ml|cup|cups|glass|glasses|bowl|bowls)\b/.test(blob)
  ) {
    return { unit: 'cups', shortLabel: 'cups' };
  }
  if (
    /\b(piece|pieces|pcs|idli|idly|dosa|roti|chapati|paratha|vada|egg|biscuit|cookie|medium)\b/.test(blob)
    || /\b1\s+(piece|idli|dosa|roti|medium)\b/.test(blob)
  ) {
    return { unit: 'pcs', shortLabel: 'pcs' };
  }
  return { unit: 'servings', shortLabel: 'servings' };
}

/**
 * Reference weight for one logged unit (1 banana / 1 idli / 1 cup).
 * @param {object} item
 */
export function referenceWeightG(item) {
  const w = Number(item?.weight_g);
  return w > 0 ? w : 100;
}

/**
 * @param {object} item
 * @param {number} servings
 */
export function formatServingPortion(item, servings) {
  const count = Number(servings);
  const n = Number.isFinite(count) && count > 0 ? count : 1;
  const base = String(item?.portion || item?.portion_label || '').trim();
  const { shortLabel } = resolveQuantityUnit(item);
  if (base) {
    if (n === 1) return base;
    // "1 medium banana" → "2 × 1 medium banana"; "1 piece" → "2 pieces"
    if (/^1\s+piece\b/i.test(base) && n !== 1) return `${n} pieces`;
    return `${n} × ${base}`;
  }
  return n === 1 ? `1 ${shortLabel.replace(/s$/, '')}` : `${n} ${shortLabel}`;
}

/**
 * Deduplicate search buckets: master > my history > community (exact name).
 * Keeps distinct foods (Banana Chips stays even if Banana is in master).
 * @param {{ masterItems?: object[], myItems?: object[], communityItems?: object[] }} parts
 */
export function dedupeSearchBuckets({ masterItems = [], myItems = [], communityItems = [] }) {
  const keyOf = (item) => String(item?.name || '').toLowerCase().trim();
  const master = [];
  const seen = new Set();
  for (const item of masterItems) {
    const k = keyOf(item);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    master.push(item);
  }
  const my = [];
  for (const item of myItems) {
    const k = keyOf(item);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    my.push(item);
  }
  const community = [];
  for (const item of communityItems) {
    const k = keyOf(item);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    community.push(item);
  }
  return { masterItems: master, myItems: my, communityItems: community };
}

/**
 * Manual / plate save payload → diary analysisResult (preserves micros).
 * @param {object} m
 */
export function buildAnalysisFromManualFood(m) {
  const toItem = (f) => {
    const nutrition = pickNutrition(f.nutrition || f);
    // Flat macros from older callers / forms.
    for (const key of ['calories', 'protein', 'carbs', 'fat', 'fiber']) {
      if (f[key] != null && f[key] !== '' && nutrition[key] == null) {
        const n = Number(f[key]);
        if (Number.isFinite(n)) nutrition[key] = n;
      }
    }
    if (nutrition.calories == null) nutrition.calories = 0;
    if (nutrition.protein == null) nutrition.protein = 0;
    if (nutrition.carbs == null) nutrition.carbs = 0;
    if (nutrition.fat == null) nutrition.fat = 0;
    if (nutrition.fiber == null) nutrition.fiber = 0;
    const item = { name: f.name || f.foodName, nutrition };
    if (f.portion) item.portion = f.portion;
    if (f.weight_g != null) item.weight_g = f.weight_g;
    if (f.isLiquid != null) item.isLiquid = f.isLiquid;
    if (f.volume_ml != null) item.volume_ml = f.volume_ml;
    return item;
  };

  if (m.isPlate && Array.isArray(m.items)) {
    const foods = m.items.map(toItem);
    const total = m.total && Object.keys(pickNutrition(m.total)).length > 0
      ? pickNutrition(m.total)
      : sumNutrition(foods.map((f) => f.nutrition));
    return { foods, total, confidence: 'high' };
  }

  const item = toItem({
    name: m.foodName,
    foodName: m.foodName,
    calories: m.calories,
    protein: m.protein,
    carbs: m.carbs,
    fat: m.fat,
    fiber: m.fiber,
    nutrition: m.nutrition,
    portion: m.portion,
    weight_g: m.weight_g,
  });
  return { foods: [item], total: item.nutrition, confidence: 'high' };
}
