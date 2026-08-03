/**
 * frontend/src/features/nutrition/domain/shakeProductProfiles.js
 *
 * Scoop / powder-weight metadata for the Shake Calculator steppers.
 * Nutrition for the prepared shake comes from herbalifeShakeProfile.js
 * (same values as AI / backend HERBALIFE_SHAKE_NUTRITION) — not per-scoop macros.
 *
 * Standard recipe: F1 3×25g + Shakemate 2×27g + PPP 1×6g = 58 g.
 */

/**
 * @typedef {Object} ShakeProductProfile
 * @property {string}  id
 * @property {string}  label
 * @property {string}  unit
 * @property {number}  scoopsPerPack
 * @property {number}  packWeightG
 * @property {number}  defaultServings
 * @property {number}  minServings
 * @property {number}  maxServings
 */

/** @type {Readonly<Record<string, ShakeProductProfile>>} */
export const SHAKE_PRODUCTS = Object.freeze({
  formula1: {
    id: 'formula1',
    label: 'Formula 1 Shake',
    unit: 'scoop (3 scoops = 25 g)',
    scoopsPerPack: 3,
    packWeightG: 25,
    defaultServings: 3,
    minServings: 0,
    maxServings: 6,
  },

  shakemate: {
    id: 'shakemate',
    label: 'Shakemate',
    unit: 'scoop (2 scoops = 27 g)',
    scoopsPerPack: 2,
    packWeightG: 27,
    defaultServings: 2,
    minServings: 0,
    maxServings: 6,
  },

  protein: {
    id: 'protein',
    label: 'Protein Powder',
    unit: 'scoop (1 scoop = 6 g)',
    scoopsPerPack: 1,
    packWeightG: 6,
    defaultServings: 1,
    minServings: 0,
    maxServings: 6,
  },
});

export const SHAKE_PRODUCT_IDS = Object.freeze(['formula1', 'shakemate', 'protein']);
