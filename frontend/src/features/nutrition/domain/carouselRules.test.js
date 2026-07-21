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
import { computeCaloriesCard } from './carouselRules';

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
  test('1000 food, 1500 watch burned → net clamped to 0', () => {
    const r = calc(1800, 1000, 1500);
    expect(r.net).toBe(0);            // max(0, 1000-1500)
    expect(r.remaining).toBe(1800);   // full target remaining
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
