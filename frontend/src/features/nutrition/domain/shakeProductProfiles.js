/**
 * frontend/src/features/nutrition/domain/shakeProductProfiles.js
 *
 * Static nutritional profiles for Herbalife shake products.
 * Pure constants — zero I/O, zero side-effects.
 *
 * IMPORTANT: Values must be verified against official Herbalife product
 * documentation before shipping. Sources:
 *   - Formula 1 Nutritional Shake Mix (Indian variant, 26g / 2 scoops serving)
 *   - Protein Drink Mix / Shakemate (10g / 1 scoop serving)
 *   - Personalised Protein Powder (28g / 2 scoops serving)
 *
 * Owner: @nutrition-team
 * Do NOT add I/O, API calls, or React imports to this file.
 *
 * Per domain rules (claude.md §4): business data lives in domain/.
 * Per aggregateFoodTotals contract (domain/aggregateFoodTotals.js):
 *   each `perServing` must include all 8 macro fields:
 *   calories, protein, carbs, fat, fiber, sugar, sodium, cholesterol.
 */

/**
 * @typedef {Object} ShakeProductProfile
 * @property {string}  id              Stable identifier used as state key.
 * @property {string}  label           Human-readable product name.
 * @property {string}  unit            Serving unit shown in the calculator UI.
 * @property {number}  defaultServings Initial serving count pre-filled in the UI.
 * @property {number}  minServings     Minimum allowed value (always 0).
 * @property {number}  maxServings     Maximum allowed value (soft cap for the UI stepper).
 * @property {Object}  perServing      Macro + micro values per single serving.
 */

/** @type {Readonly<Record<string, ShakeProductProfile>>} */
export const SHAKE_PRODUCTS = Object.freeze({
  formula1: {
    id: 'formula1',
    label: 'Formula 1 Shake',
    unit: 'scoop (26 g)',
    defaultServings: 2,
    minServings: 0,
    maxServings: 4,
    perServing: Object.freeze({
      // Per 2-scoop (26 g) serving mixed with 250 ml skimmed milk.
      // Approximate values — verify against product label before release.
      calories:    105,
      protein:     5,
      carbs:       18,
      fat:         0.5,
      fiber:       4.5,
      sugar:       7,
      sodium:      0.085, // g
      cholesterol: 0,
    }),
  },

  shakemate: {
    id: 'shakemate',
    label: 'Shakemate (PDM)',
    unit: 'scoop (10 g)',
    defaultServings: 1,
    minServings: 0,
    maxServings: 4,
    perServing: Object.freeze({
      // Protein Drink Mix — one 10 g scoop.
      // Approximate values — verify against product label before release.
      calories:    35,
      protein:     7.5,
      carbs:       1,
      fat:         0.5,
      fiber:       0,
      sugar:       0.5,
      sodium:      0.06,
      cholesterol: 0,
    }),
  },

  protein: {
    id: 'protein',
    label: 'Protein Powder (PPP)',
    unit: 'scoop (7 g)',
    defaultServings: 0,
    minServings: 0,
    maxServings: 4,
    perServing: Object.freeze({
      // Personalised Protein Powder — one 7 g scoop.
      // Approximate values — verify against product label before release.
      calories:    28,
      protein:     5,
      carbs:       1.5,
      fat:         0.5,
      fiber:       0,
      sugar:       0,
      sodium:      0.03,
      cholesterol: 0,
    }),
  },
});

/** Ordered array for rendering the calculator rows top-to-bottom. */
export const SHAKE_PRODUCT_IDS = Object.freeze(['formula1', 'shakemate', 'protein']);
