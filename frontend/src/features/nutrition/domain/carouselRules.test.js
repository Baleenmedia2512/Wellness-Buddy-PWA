/**
 * carouselRules.test.js
 *
 * Unit tests for computeCaloriesCard — the canonical calorie calculation used
 * by the Home dashboard carousel (CaloriesCard) and HomeNutritionCarousel.
 *
 * Formula under test:
 *   Net Calories = Food Calories − Exercise Calories − Smartwatch Burned Calories
 *   (Smartwatch burned calories are always treated as exercise calories.)
 *
 * Run: npx react-scripts test --watchAll=false --testPathPattern=carouselRules.test
 */
import { computeCaloriesCard, computeMacroTargets, computeFatTargetGrams } from './carouselRules';

// ─── Helper ────────────────────────────────────────────────────────────────────

function calc(calorieTarget, consumedCalories, burnedCalories = 0) {
  return computeCaloriesCard({ calorieTarget, consumedCalories, burnedCalories });
}

// ─── Scenario 1: No exercise — baseline ───────────────────────────────────────
describe('computeCaloriesCard — no exercise', () => {
  test('under target: 1500 food / 1800 target', () => {
    const r = calc(1800, 1500);
    expect(r.target).toBe(1800);
    expect(r.consumed).toBe(1500);
    expect(r.exercise).toBe(0);
    expect(r.net).toBe(1500);
    expect(r.remaining).toBe(300);
    expect(r.progressPercent).toBe(83); // round(1500/1800*100)
  });

  test('exactly on target: 1800 food / 1800 target', () => {
    const r = calc(1800, 1800);
    expect(r.net).toBe(1800);
    expect(r.remaining).toBe(0);
    expect(r.progressPercent).toBe(100);
  });

  test('over target: 2100 food / 1800 target', () => {
    const r = calc(1800, 2100);
    expect(r.net).toBe(2100);
    expect(r.remaining).toBe(0);      // no remaining when over
    expect(r.progressPercent).toBe(117); // round(2100/1800*100)
  });
});

// ─── Scenario 2: Smartwatch exercise — net under target ───────────────────────
describe('computeCaloriesCard — smartwatch burns bring net under target', () => {
  test('2000 food, 300 watch burned, 1800 target → net=1700, remaining=100', () => {
    const r = calc(1800, 2000, 300);
    expect(r.net).toBe(1700);         // 2000 - 300
    expect(r.remaining).toBe(100);    // 1800 - 1700
    expect(r.progressPercent).toBe(94); // round(1700/1800*100)
    // Must NOT show "Exceeded" since net < target
    expect(r.progressPercent).toBeLessThan(100);
  });

  test('1800 food, 400 watch burned, 1800 target → net=1400, remaining=400', () => {
    const r = calc(1800, 1800, 400);
    expect(r.net).toBe(1400);
    expect(r.remaining).toBe(400);
    expect(r.progressPercent).toBe(78); // round(1400/1800*100)
  });
});

// ─── Scenario 3: Smartwatch exercise — net still over target ──────────────────
describe('computeCaloriesCard — smartwatch burns but still over target', () => {
  test('2500 food, 300 watch burned, 1800 target → net=2200, exceeded', () => {
    const r = calc(1800, 2500, 300);
    expect(r.net).toBe(2200);         // 2500 - 300
    expect(r.remaining).toBe(0);      // still over
    expect(r.progressPercent).toBe(122); // round(2200/1800*100)
    expect(r.progressPercent).toBeGreaterThan(100);
  });
});

// ─── Scenario 4: Exercise exceeds food (aggressive workout) ───────────────────
describe('computeCaloriesCard — burned > consumed', () => {
  test('1000 food, 1500 watch burned → remaining = goal − food + exercise', () => {
    const r = calc(1800, 1000, 1500);
    expect(r.net).toBe(-500);         // 1000 − 1500
    expect(r.remaining).toBe(2300);   // 1800 − 1000 + 1500
    expect(r.progressPercent).toBe(0); // no net food intake toward goal
  });

  test('0 food, 441 watch burned → remaining = goal + exercise (home carousel case)', () => {
    const r = calc(1845, 0, 441);
    expect(r.net).toBe(-441);
    expect(r.remaining).toBe(2286);   // 1845 + 441
    expect(r.exercise).toBe(441);
    expect(r.progressPercent).toBe(0);
  });
});

// ─── Scenario 5: Zero / missing inputs ────────────────────────────────────────
describe('computeCaloriesCard — zero and missing inputs', () => {
  test('no inputs → defaults to 1500 target', () => {
    const r = calc(0, 0, 0);
    expect(r.target).toBe(1500);
    expect(r.net).toBe(0);
    expect(r.remaining).toBe(1500);
    expect(r.progressPercent).toBe(0);
  });

  test('null burnedCalories defaults to 0', () => {
    const r = computeCaloriesCard({ calorieTarget: 1800, consumedCalories: 1500, burnedCalories: null });
    expect(r.exercise).toBe(0);
    expect(r.net).toBe(1500);
  });

  test('undefined burnedCalories defaults to 0', () => {
    const r = computeCaloriesCard({ calorieTarget: 1800, consumedCalories: 1500 });
    expect(r.exercise).toBe(0);
    expect(r.net).toBe(1500);
  });
});

// ─── Scenario 6: progressPercent uses net, not raw food ───────────────────────
describe('computeCaloriesCard — progressPercent reflects net, not raw food', () => {
  test('raw food is 111% of target but net is 94% after 300 kcal exercise', () => {
    const r = calc(1800, 2000, 300);
    // Raw: round(2000/1800*100) = 111 — this was the WRONG value before the fix
    const rawProgress = Math.round((2000 / 1800) * 100);
    expect(rawProgress).toBe(111);
    // Net-based (correct): round(1700/1800*100) = 94
    expect(r.progressPercent).toBe(94);
    expect(r.progressPercent).not.toBe(rawProgress);
  });

  test('progressPercent is capped implicitly via the ring rendering but net can exceed 100', () => {
    // When net > target, progressPercent > 100 — this drives the "Exceeded" ring in UI
    const r = calc(1800, 2500, 100);
    expect(r.net).toBe(2400);
    expect(r.progressPercent).toBeGreaterThan(100);
  });
});

// ─── Scenario 7: Backward-compatible return shape ─────────────────────────────
describe('computeCaloriesCard — return shape includes net', () => {
  test('returns { target, consumed, exercise, net, remaining, progressPercent }', () => {
    const r = calc(1800, 2000, 300);
    expect(r).toHaveProperty('target', 1800);
    expect(r).toHaveProperty('consumed', 2000);
    expect(r).toHaveProperty('exercise', 300);
    expect(r).toHaveProperty('net', 1700);
    expect(r).toHaveProperty('remaining', 100);
    expect(r).toHaveProperty('progressPercent', 94);
  });
});

// ─── Fat target: calorieTarget × gender% / 9 ──────────────────────────────────
describe('computeFatTargetGrams', () => {
  test('male: 20% of calorie target / 9', () => {
    // 1800 × 0.20 / 9 = 40
    expect(computeFatTargetGrams(1800, 'Male')).toBe(40);
  });

  test('female: 30% of calorie target / 9', () => {
    // 1800 × 0.30 / 9 = 60
    expect(computeFatTargetGrams(1800, 'Female')).toBe(60);
  });

  test('unknown gender uses 25% midpoint', () => {
    // 1800 × 0.25 / 9 = 50
    expect(computeFatTargetGrams(1800, null)).toBe(50);
  });
});

describe('computeMacroTargets — gender-based fat', () => {
  test('uses gender fat formula and derives carbs from remaining calories', () => {
    const r = computeMacroTargets({
      latestWeight: 70,
      calorieTarget: 1800,
      gender: 'Male',
    });
    expect(r.proteinTarget).toBe(105); // 70 × 1.5
    expect(r.fatTarget).toBe(40); // 1800 × 20% / 9
    // carbs = (1800 - 105*4 - 40*9) / 4 = (1800 - 420 - 360) / 4 = 255
    expect(r.carbsTarget).toBe(255);
  });

  test('female fat target is 30% of calories / 9', () => {
    const r = computeMacroTargets({
      latestWeight: 70,
      calorieTarget: 1800,
      gender: 'Female',
    });
    expect(r.fatTarget).toBe(60);
  });
});
