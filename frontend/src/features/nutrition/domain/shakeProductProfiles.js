/**
 * frontend/src/features/nutrition/domain/shakeProductProfiles.js
 *
 * Scoop / powder-weight metadata for the Shake Calculator steppers.
 * Nutrition for the prepared shake comes from herbalifeShakeProfile.js
 * (same values as AI / backend HERBALIFE_SHAKE_NUTRITION) — not per-scoop macros.
 * Active Fibre Complex is additive (label per-scoop macros), not part of the 58 g base mix.
 *
 * Standard recipe: F1 3×25g + Shakemate 2×27g + PPP 1×6g = 58 g.
 * Optional add-on: Active Fibre Complex 1 scoop = 6.7 g (default 0).
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
 * @property {boolean} [additive]  When true, nutrition is summed from label per scoop (not base mix scale).
 */

/** Base Formula 1 + Shakemate + Protein — scaled via HERBALIFE_SHAKE_STANDARD. */
export const BASE_SHAKE_PRODUCT_IDS = Object.freeze(['formula1', 'shakemate', 'protein']);

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
    label: 'Personalized Protein',
    unit: 'scoop (1 scoop = 6 g)',
    scoopsPerPack: 1,
    packWeightG: 6,
    defaultServings: 1,
    minServings: 0,
    maxServings: 6,
  },

  activeFibre: {
    id: 'activeFibre',
    label: 'Active Fibre Complex',
    unit: 'scoop (1 scoop = 6.7 g)',
    scoopsPerPack: 1,
    packWeightG: 6.7,
    defaultServings: 0,
    minServings: 0,
    maxServings: 6,
    additive: true,
  },
});

export const SHAKE_PRODUCT_IDS = Object.freeze([
  ...BASE_SHAKE_PRODUCT_IDS,
  'activeFibre',
]);
