/**
 * carouselRules.test.js — unit tests for the Nutrition Carousel domain rules.
 * Coverage target: 95% line, 90% branch (claude.md §9.1 — domain/ floor).
 */
import {
  computeCaloriesCard,
  computeMacroTargets,
  computeMacroProgress,
  computeHeartHealthyCard,
  computeLowCarbCard,
  computeGICard,
  SODIUM_TARGET_MG,
  CHOLESTEROL_TARGET_MG,
  SUGAR_TARGET_G,
  FIBER_TARGET_G,
} from '../domain/carouselRules';

// ─── computeCaloriesCard ──────────────────────────────────────────────────────

describe('computeCaloriesCard', () => {
  it('normal intake: remaining = target - consumed', () => {
    const r = computeCaloriesCard({ calorieTarget: 2000, consumedCalories: 1200 });
    expect(r.target).toBe(2000);
    expect(r.consumed).toBe(1200);
    expect(r.exercise).toBe(0);
    expect(r.remaining).toBe(800);
    expect(r.progressPercent).toBe(60);
  });

  it('over target: remaining = 0, progressPercent reflects actual overage (no cap)', () => {
    const r = computeCaloriesCard({ calorieTarget: 1500, consumedCalories: 2000 });
    expect(r.remaining).toBe(0);
    expect(r.progressPercent).toBe(133); // 2000/1500 = 133% (red zone: >100%)
  });

  it('progressPercent in red zone (>100%) when moderately over target', () => {
    const r = computeCaloriesCard({ calorieTarget: 2000, consumedCalories: 2500 });
    expect(r.progressPercent).toBe(125); // red zone starts immediately after 100%
  });

  it('progressPercent in red zone when far over target', () => {
    const r = computeCaloriesCard({ calorieTarget: 1000, consumedCalories: 1600 });
    expect(r.progressPercent).toBe(160); // all above 100% is red
  });

  it('zero consumed: all zeros, progressPercent = 0', () => {
    const r = computeCaloriesCard({ calorieTarget: 2000, consumedCalories: 0 });
    expect(r.consumed).toBe(0);
    expect(r.remaining).toBe(2000);
    expect(r.progressPercent).toBe(0);
  });

  it('missing BMR: falls back to 1500', () => {
    const r = computeCaloriesCard({ calorieTarget: 0, consumedCalories: 500 });
    expect(r.target).toBe(1500);
    expect(r.remaining).toBe(1000);
  });

  it('exercise calories reduce remaining', () => {
    const r = computeCaloriesCard({ calorieTarget: 2000, consumedCalories: 1800, burnedCalories: 200 });
    expect(r.exercise).toBe(200);
    expect(r.remaining).toBe(400);
  });

  it('negative consumed defaults to 0', () => {
    const r = computeCaloriesCard({ calorieTarget: 2000, consumedCalories: -100 });
    expect(r.consumed).toBe(0);
  });
});

// ─── computeMacroTargets ─────────────────────────────────────────────────────

describe('computeMacroTargets', () => {
  it('calculates targets from weight 70kg, 2000 kcal', () => {
    const r = computeMacroTargets({ latestWeight: 70, calorieTarget: 2000 });
    expect(r.proteinTarget).toBe(105);   // 70 * 1.5
    expect(r.fatTarget).toBe(53);        // Math.round(70 * 0.75) = Math.round(52.5) = 53
    // (2000 - 105*4 - 53*9) / 4 = (2000 - 420 - 477) / 4 = 1103/4 ≈ 276
    expect(r.carbsTarget).toBe(276);
  });

  it('returns null targets when weight is null', () => {
    const r = computeMacroTargets({ latestWeight: null, calorieTarget: 2000 });
    expect(r.proteinTarget).toBeNull();
    expect(r.fatTarget).toBeNull();
    expect(r.carbsTarget).toBeNull();
  });

  it('returns null targets when weight = 0', () => {
    const r = computeMacroTargets({ latestWeight: 0, calorieTarget: 2000 });
    expect(r.proteinTarget).toBeNull();
  });

  it('carbs target clamped to 0 when high protein+fat eats all calories', () => {
    // Extreme: 200kg user, 1500 kcal — protein=400, fat=160 → negative carbs
    const r = computeMacroTargets({ latestWeight: 200, calorieTarget: 1500 });
    expect(r.carbsTarget).toBe(0);
  });

  it('falls back to 1500 kcal target when calorieTarget = 0', () => {
    const r = computeMacroTargets({ latestWeight: 60, calorieTarget: 0 });
    expect(r.proteinTarget).toBe(90);   // 60 * 1.5
    expect(r.fatTarget).toBe(45);       // Math.round(60 * 0.75)
    expect(r.carbsTarget).toBeGreaterThanOrEqual(0);
  });
});

// ─── computeMacroProgress ────────────────────────────────────────────────────

describe('computeMacroProgress', () => {
  it('50g consumed of 100g target = 50%', () => {
    expect(computeMacroProgress({ consumed: 50, target: 100 }).progressPercent).toBe(50);
  });

  it('clamps to 100% when over target', () => {
    expect(computeMacroProgress({ consumed: 200, target: 100 }).progressPercent).toBe(100);
  });

  it('returns 0% when target is null', () => {
    expect(computeMacroProgress({ consumed: 100, target: null }).progressPercent).toBe(0);
  });

  it('returns 0% when target is 0', () => {
    expect(computeMacroProgress({ consumed: 100, target: 0 }).progressPercent).toBe(0);
  });
});

// ─── computeHeartHealthyCard ─────────────────────────────────────────────────

describe('computeHeartHealthyCard', () => {
  it('calculates fat/sodium/cholesterol with all values', () => {
    const r = computeHeartHealthyCard({
      consumedFat: 40, consumedSodium: 1150, consumedCholesterol: 150, fatTarget: 56,
    });
    expect(r.fat.consumed).toBe(40);
    expect(r.fat.pct).toBe(71);
    expect(r.sodium.target).toBe(SODIUM_TARGET_MG);
    expect(r.sodium.pct).toBe(50);
    expect(r.cholesterol.target).toBe(CHOLESTEROL_TARGET_MG);
    expect(r.cholesterol.pct).toBe(50);
  });

  it('pct clamped at 100 when over limit', () => {
    const r = computeHeartHealthyCard({
      consumedFat: 100, consumedSodium: 5000, consumedCholesterol: 600, fatTarget: 56,
    });
    expect(r.sodium.pct).toBe(100);
    expect(r.cholesterol.pct).toBe(100);
  });

  it('null fat target: fat.pct = 0', () => {
    const r = computeHeartHealthyCard({
      consumedFat: 30, consumedSodium: 0, consumedCholesterol: 0, fatTarget: null,
    });
    expect(r.fat.target).toBeNull();
    expect(r.fat.pct).toBe(0);
  });

  it('all zeros: pct = 0', () => {
    const r = computeHeartHealthyCard({
      consumedFat: 0, consumedSodium: 0, consumedCholesterol: 0, fatTarget: 56,
    });
    expect(r.sodium.pct).toBe(0);
    expect(r.cholesterol.pct).toBe(0);
    expect(r.fat.pct).toBe(0);
  });
});

// ─── computeLowCarbCard ──────────────────────────────────────────────────────

describe('computeLowCarbCard', () => {
  it('calculates carbs/sugar/fiber with all values', () => {
    const r = computeLowCarbCard({
      consumedCarbs: 120, consumedSugar: 25, consumedFiber: 20, carbsTarget: 234,
    });
    expect(r.carbs.consumed).toBe(120);
    expect(r.carbs.pct).toBe(51);
    expect(r.sugar.target).toBe(SUGAR_TARGET_G);
    expect(r.sugar.pct).toBe(50);
    expect(r.fiber.target).toBe(FIBER_TARGET_G);
    expect(r.fiber.pct).toBe(80);
  });

  it('pct clamped at 100 for sugar over limit', () => {
    const r = computeLowCarbCard({
      consumedCarbs: 0, consumedSugar: 200, consumedFiber: 0, carbsTarget: 234,
    });
    expect(r.sugar.pct).toBe(100);
  });

  it('null carbs target: carbs.pct = 0', () => {
    const r = computeLowCarbCard({
      consumedCarbs: 100, consumedSugar: 0, consumedFiber: 0, carbsTarget: null,
    });
    expect(r.carbs.target).toBeNull();
    expect(r.carbs.pct).toBe(0);
  });

  it('all zeros: pct = 0', () => {
    const r = computeLowCarbCard({
      consumedCarbs: 0, consumedSugar: 0, consumedFiber: 0, carbsTarget: 200,
    });
    expect(r.carbs.pct).toBe(0);
    expect(r.sugar.pct).toBe(0);
    expect(r.fiber.pct).toBe(0);
  });

  it('fiber at 100% = achieved goal', () => {
    const r = computeLowCarbCard({
      consumedCarbs: 0, consumedSugar: 0, consumedFiber: 25, carbsTarget: 200,
    });
    expect(r.fiber.pct).toBe(100);
  });
});

// ─── Personalized targets ─────────────────────────────────────────────────────

describe('computeHeartHealthyCard — personalized targets', () => {
  it('sodium target scales with weight*30, capped at 2300 mg', () => {
    const r60  = computeHeartHealthyCard({ consumedFat: 0, consumedSodium: 0, consumedCholesterol: 0, fatTarget: null, weight: 60 });
    const r100 = computeHeartHealthyCard({ consumedFat: 0, consumedSodium: 0, consumedCholesterol: 0, fatTarget: null, weight: 100 });
    expect(r60.sodium.target).toBe(1800);    // 60 * 30
    expect(r100.sodium.target).toBe(2300);   // 100 * 30 = 3000, capped to 2300
  });

  it('sodium target falls back to 2300 when weight is null', () => {
    const r = computeHeartHealthyCard({ consumedFat: 0, consumedSodium: 0, consumedCholesterol: 0, fatTarget: null, weight: null });
    expect(r.sodium.target).toBe(SODIUM_TARGET_MG);
  });

  it('cholesterol target reduced by 1 mg per kg above 70 kg', () => {
    const r = computeHeartHealthyCard({ consumedFat: 0, consumedSodium: 0, consumedCholesterol: 0, fatTarget: null, weight: 90 });
    expect(r.cholesterol.target).toBe(280); // 300 - (90 - 70) = 280
  });

  it('cholesterol target floored at 200 mg for very heavy users', () => {
    const r = computeHeartHealthyCard({ consumedFat: 0, consumedSodium: 0, consumedCholesterol: 0, fatTarget: null, weight: 200 });
    expect(r.cholesterol.target).toBe(200); // 300 - 130 = 170, floored to 200
  });

  it('cholesterol target is 300 mg when weight is at ref (70 kg)', () => {
    const r = computeHeartHealthyCard({ consumedFat: 0, consumedSodium: 0, consumedCholesterol: 0, fatTarget: null, weight: 70 });
    expect(r.cholesterol.target).toBe(300);
  });

  it('cholesterol target falls back to 300 mg when weight is null', () => {
    const r = computeHeartHealthyCard({ consumedFat: 0, consumedSodium: 0, consumedCholesterol: 0, fatTarget: null, weight: null });
    expect(r.cholesterol.target).toBe(CHOLESTEROL_TARGET_MG);
  });

  it('pct recalculates correctly against personalized sodium target', () => {
    // weight 60 → sodiumTarget 1800. consumed 900 → 50 %
    const r = computeHeartHealthyCard({ consumedFat: 0, consumedSodium: 900, consumedCholesterol: 0, fatTarget: null, weight: 60 });
    expect(r.sodium.pct).toBe(50);
  });
});

describe('computeLowCarbCard — personalized sugar target', () => {
  it('sugar target = 10% of calorieTarget / 4 kcal per gram', () => {
    const r = computeLowCarbCard({ consumedCarbs: 0, consumedSugar: 0, consumedFiber: 0, carbsTarget: null, calorieTarget: 2000 });
    expect(r.sugar.target).toBe(50); // 2000 * 0.1 / 4
  });

  it('sugar target scales down with lower calorie target', () => {
    const r = computeLowCarbCard({ consumedCarbs: 0, consumedSugar: 0, consumedFiber: 0, carbsTarget: null, calorieTarget: 1500 });
    expect(r.sugar.target).toBe(38); // Math.round(1500 * 0.1 / 4) = Math.round(37.5) = 38
  });

  it('sugar target falls back to 50 g when calorieTarget is null', () => {
    const r = computeLowCarbCard({ consumedCarbs: 0, consumedSugar: 0, consumedFiber: 0, carbsTarget: null, calorieTarget: null });
    expect(r.sugar.target).toBe(SUGAR_TARGET_G);
  });

  it('sugar target falls back to 50 g when calorieTarget is 0', () => {
    const r = computeLowCarbCard({ consumedCarbs: 0, consumedSugar: 0, consumedFiber: 0, carbsTarget: null, calorieTarget: 0 });
    expect(r.sugar.target).toBe(SUGAR_TARGET_G);
  });

  it('pct recalculates correctly against personalized sugar target', () => {
    // calorieTarget 2000 → sugarTarget 50. consumed 25 → 50 %
    const r = computeLowCarbCard({ consumedCarbs: 0, consumedSugar: 25, consumedFiber: 0, carbsTarget: null, calorieTarget: 2000 });
    expect(r.sugar.pct).toBe(50);
  });
});

// ─── Card 5: Glycemic Index ───────────────────────────────────────────────────

describe('computeGICard', () => {
  it('returns Low zone when GI ≤55', () => {
    const r = computeGICard({ averageGlycemicIndex: 45, mealCount: 2 });
    expect(r.averageGI).toBe(45);
    expect(r.zone).toBe('Low');
    expect(r.mealCount).toBe(2);
  });

  it('returns Low zone at boundary (GI = 55)', () => {
    const r = computeGICard({ averageGlycemicIndex: 55, mealCount: 3 });
    expect(r.averageGI).toBe(55);
    expect(r.zone).toBe('Low');
  });

  it('returns Medium zone when 56 ≤ GI ≤ 69', () => {
    const r = computeGICard({ averageGlycemicIndex: 62, mealCount: 1 });
    expect(r.averageGI).toBe(62);
    expect(r.zone).toBe('Medium');
  });

  it('returns Medium zone at lower boundary (GI = 56)', () => {
    const r = computeGICard({ averageGlycemicIndex: 56, mealCount: 4 });
    expect(r.averageGI).toBe(56);
    expect(r.zone).toBe('Medium');
  });

  it('returns Medium zone at upper boundary (GI = 69)', () => {
    const r = computeGICard({ averageGlycemicIndex: 69, mealCount: 2 });
    expect(r.averageGI).toBe(69);
    expect(r.zone).toBe('Medium');
  });

  it('returns High zone when GI ≥ 70', () => {
    const r = computeGICard({ averageGlycemicIndex: 78, mealCount: 5 });
    expect(r.averageGI).toBe(78);
    expect(r.zone).toBe('High');
  });

  it('returns High zone at boundary (GI = 70)', () => {
    const r = computeGICard({ averageGlycemicIndex: 70, mealCount: 1 });
    expect(r.averageGI).toBe(70);
    expect(r.zone).toBe('High');
  });

  it('returns null zone when no meals logged', () => {
    const r = computeGICard({ averageGlycemicIndex: null, mealCount: 0 });
    expect(r.averageGI).toBeNull();
    expect(r.zone).toBeNull();
    expect(r.mealCount).toBe(0);
  });

  it('returns null zone when averageGlycemicIndex is null even with meals', () => {
    // Edge case: legacy data where meals exist but GI was never computed
    const r = computeGICard({ averageGlycemicIndex: null, mealCount: 3 });
    expect(r.averageGI).toBeNull();
    expect(r.zone).toBeNull();
  });

  it('rounds GI to whole number', () => {
    const r = computeGICard({ averageGlycemicIndex: 62.7, mealCount: 2 });
    expect(r.averageGI).toBe(63);
  });

  it('returns 0 meals when mealCount is 0', () => {
    const r = computeGICard({ averageGlycemicIndex: 50, mealCount: 0 });
    expect(r.mealCount).toBe(0);
    expect(r.averageGI).toBeNull(); // null because mealCount=0
  });
});
