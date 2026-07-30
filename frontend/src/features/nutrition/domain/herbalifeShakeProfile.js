/**
 * frontend/src/features/nutrition/domain/herbalifeShakeProfile.js
 *
 * Canonical prepared Herbalife Shake recipe — must match backend
 * `HERBALIFE_SHAKE_NUTRITION` in AIGateway.js (AI path).
 *
 * Standard powder mix (58 g) + drink volume 300 ml:
 *   Formula 1  3 scoops = 25 g
 *   Shakemate  2 scoops = 27 g
 *   Protein    1 scoop  =  6 g
 *
 * Pure constants — zero I/O.
 */

export const HERBALIFE_SHAKE_NAME = 'Herbalife Shake';

/** Standard recipe powder weight (g) and prepared drink volume (ml). */
export const HERBALIFE_SHAKE_STANDARD = Object.freeze({
  name: 'Herbalife Shake',
  portion: '1 serving (300ml)',
  weight_g: 58,
  volume_ml: 300,
  unit: 'ml',
  isLiquid: true,
  nutrition: Object.freeze({
    calories: 223,
    protein: 24.73,
    carbs: 24.24,
    fat: 2.98,
    fiber: 3.0,
    sugar: 11.57,
    sodium: 355, // mg (same unit as AI / diary display)
    cholesterol: 7,
    glycemic_index: 20,
    vitamin_a: 210,
    vitamin_c: 15,
    vitamin_d: 3.4,
    vitamin_e: 5,
    vitamin_k: 0,
    vitamin_b1: 0.45,
    vitamin_b2: 0.45,
    vitamin_b3: 5,
    vitamin_b6: 0.8,
    vitamin_b9: 85,
    vitamin_b12: 0.4,
    calcium: 129,
    iron: 3,
    magnesium: 50,
    potassium: 260,
    zinc: 2.5,
    phosphorus: 0,
  }),
});

/**
 * Powder grams for current scoop counts using pack ratios
 * (3 scoops = 25 g F1, 2 = 27 g Shakemate, 1 = 6 g PPP).
 * @param {Record<string, number>} servings
 * @param {Record<string, { scoopsPerPack: number, packWeightG: number }>} products
 */
export function powderGramsFromServings(servings, products) {
  let grams = 0;
  for (const id of Object.keys(products)) {
    const p = products[id];
    const scoops = Number(servings[id]) || 0;
    if (scoops <= 0 || !p?.scoopsPerPack || !p?.packWeightG) continue;
    grams += (scoops / p.scoopsPerPack) * p.packWeightG;
  }
  return grams;
}

/**
 * Scale the canonical shake nutrition by powder-weight ratio vs 58 g standard.
 * @param {number} powderGrams
 */
export function scaleHerbalifeShakeNutrition(powderGrams) {
  const base = HERBALIFE_SHAKE_STANDARD.nutrition;
  const ratio = powderGrams > 0 ? powderGrams / HERBALIFE_SHAKE_STANDARD.weight_g : 0;
  const nutrition = {};
  for (const [key, value] of Object.entries(base)) {
    nutrition[key] = Math.round((Number(value) || 0) * ratio * 100) / 100;
  }
  return {
    name: HERBALIFE_SHAKE_NAME,
    portion: powderGrams === HERBALIFE_SHAKE_STANDARD.weight_g
      ? HERBALIFE_SHAKE_STANDARD.portion
      : `${Math.round(powderGrams * 10) / 10} g powder · ~${HERBALIFE_SHAKE_STANDARD.volume_ml} ml`,
    weight_g: Math.round(powderGrams * 10) / 10,
    volume_ml: HERBALIFE_SHAKE_STANDARD.volume_ml,
    unit: HERBALIFE_SHAKE_STANDARD.unit,
    isLiquid: true,
    nutrition,
  };
}
