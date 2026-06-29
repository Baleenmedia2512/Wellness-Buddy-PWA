/**
 * frontend/src/features/nutrition/hooks/useShakeCalculator.js
 *
 * State + derived totals for the Shake Calculator feature.
 *
 * Responsibilities:
 *   - Own mutable `servings` per product (increment / decrement / set).
 *   - Derive combined macro totals via `aggregateFoodTotals` — the ONLY
 *     permitted aggregation function (claude.md §4.1 / aggregateFoodTotals.js).
 *   - Build a food-entry payload shaped exactly like the `transformToBackgroundServiceFormat`
 *     output so `saveNutritionAnalysis` can persist it without a new endpoint.
 *
 * No I/O, no network calls. Pure state + computation.
 */

import { useCallback, useMemo, useState } from 'react';
import { SHAKE_PRODUCTS, SHAKE_PRODUCT_IDS } from '../domain/shakeProductProfiles';
import { aggregateFoodTotals } from '../domain/aggregateFoodTotals';

/**
 * Build the initial servings object from the profiles' defaultServings values.
 * @returns {Record<string, number>}
 */
function buildDefaultServings() {
  return SHAKE_PRODUCT_IDS.reduce((acc, id) => {
    acc[id] = SHAKE_PRODUCTS[id].defaultServings;
    return acc;
  }, {});
}

/**
 * Scale a product's `perServing` object by the number of servings.
 * Returns a food-item object compatible with `aggregateFoodTotals`.
 *
 * @param {string} id
 * @param {number} count
 * @returns {Object}
 */
function scaleProduct(id, count) {
  const profile = SHAKE_PRODUCTS[id];
  if (!profile || count <= 0) return null;
  const s = profile.perServing;
  return {
    name: `${profile.label} ×${count}`,
    nutrition: {
      calories:    s.calories    * count,
      protein:     s.protein     * count,
      carbs:       s.carbs       * count,
      fat:         s.fat         * count,
      fiber:       s.fiber       * count,
      sugar:       s.sugar       * count,
      sodium:      s.sodium      * count,
      cholesterol: s.cholesterol * count,
    },
  };
}

/**
 * @returns {{
 *   servings: Record<string, number>,
 *   totals: ReturnType<typeof aggregateFoodTotals>,
 *   hasServings: boolean,
 *   increment: (id: string) => void,
 *   decrement: (id: string) => void,
 *   setServings: (id: string, value: number) => void,
 *   reset: () => void,
 *   buildFoodPayload: () => Object,
 * }}
 */
export function useShakeCalculator() {
  const [servings, setServingsState] = useState(buildDefaultServings);

  // ─── Mutations ────────────────────────────────────────────────────────────

  const increment = useCallback((id) => {
    const profile = SHAKE_PRODUCTS[id];
    if (!profile) return;
    setServingsState((prev) => ({
      ...prev,
      [id]: Math.min(prev[id] + 1, profile.maxServings),
    }));
  }, []);

  const decrement = useCallback((id) => {
    const profile = SHAKE_PRODUCTS[id];
    if (!profile) return;
    setServingsState((prev) => ({
      ...prev,
      [id]: Math.max(prev[id] - 1, profile.minServings),
    }));
  }, []);

  const setServings = useCallback((id, value) => {
    const profile = SHAKE_PRODUCTS[id];
    if (!profile) return;
    const clamped = Math.max(profile.minServings, Math.min(profile.maxServings, Number(value) || 0));
    setServingsState((prev) => ({ ...prev, [id]: clamped }));
  }, []);

  const reset = useCallback(() => {
    setServingsState(buildDefaultServings());
  }, []);

  // ─── Derived totals ───────────────────────────────────────────────────────

  // Build the scaled food-item list for aggregation.
  const scaledItems = useMemo(() => {
    return SHAKE_PRODUCT_IDS
      .map((id) => scaleProduct(id, servings[id]))
      .filter(Boolean);
  }, [servings]);

  // aggregateFoodTotals is the canonical, single implementation for summing
  // nutrition across food items (claude.md §4 / aggregateFoodTotals.js).
  const totals = useMemo(() => aggregateFoodTotals(scaledItems), [scaledItems]);

  // True when at least one product has a non-zero serving count.
  const hasServings = useMemo(
    () => SHAKE_PRODUCT_IDS.some((id) => servings[id] > 0),
    [servings],
  );

  // ─── Payload builder ─────────────────────────────────────────────────────

  /**
   * Build an `analysisResult` payload compatible with `saveNutritionAnalysis`.
   * The shape matches what `transformToBackgroundServiceFormat` expects:
   *   { nutrition: <totals>, detailedItems: [...], confidence, processedBy }
   * so the existing persistence path requires zero backend changes.
   */
  const buildFoodPayload = useCallback(() => {
    const activeItems = SHAKE_PRODUCT_IDS
      .filter((id) => servings[id] > 0)
      .map((id) => {
        const p = SHAKE_PRODUCTS[id];
        const s = p.perServing;
        const count = servings[id];
        return {
          name: `${p.label} ×${count}`,
          portion: `${count} ${count === 1 ? p.unit : p.unit + 's'}`,
          weight_g: 0,
          nutrition: {
            calories:    s.calories    * count,
            protein:     s.protein     * count,
            carbs:       s.carbs       * count,
            fat:         s.fat         * count,
            fiber:       s.fiber       * count,
            sugar:       s.sugar       * count,
            sodium:      s.sodium      * count,
            cholesterol: s.cholesterol * count,
          },
        };
      });

    return {
      // `nutrition` → used by transformToBackgroundServiceFormat for `total`
      nutrition:     { ...totals },
      // `detailedItems` → mapped through detailedItemToFood in transformAnalysisFormat
      detailedItems: activeItems,
      confidence:    'high',
      processedBy:   'shake_calculator',
    };
  }, [servings, totals]);

  return {
    servings,
    totals,
    hasServings,
    increment,
    decrement,
    setServings,
    reset,
    buildFoodPayload,
  };
}
