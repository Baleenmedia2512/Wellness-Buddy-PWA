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

  it('over target: remaining = 0, progressPercent = 100', () => {
    const r = computeCaloriesCard({ calorieTarget: 1500, consumedCalories: 2000 });
    expect(r.remaining).toBe(0);
    expect(r.progressPercent).toBe(100);
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
    expect(r.proteinTarget).toBe(140);   // 70 * 2.0
    expect(r.fatTarget).toBe(56);        // 70 * 0.8
    // (2000 - 140*4 - 56*9) / 4 = (2000 - 560 - 504) / 4 = 936/4 = 234
    expect(r.carbsTarget).toBe(234);
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
    expect(r.proteinTarget).toBe(120);
    expect(r.fatTarget).toBe(48);
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
