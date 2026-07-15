/**
 * Unit tests for wellness score domain rules (34 individual parameters).
 * Run: node --test backend/features/wellness-score/__tests__/score.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateEducationPost,
  calculateWeightPost,
  calculateBreakfastPost,
  calculateWater,
  calculateCalories,
  calculateCarbohydrates,
  calculateFat,
  calculateProtein,
  calculateSodium,
  calculateGi,
  calculateWeightImprovement,
  calculatePhysicalActivity,
  calculateWellnessScore,
  aggregateDailyFoodStats,
} from '../domain/score.rules.js';
import { computeNutritionTargets } from '../domain/nutrition-targets.js';
import { DEFAULT_PARAMETER_CONFIG } from '../domain/parameter-registry.js';

const EDU = { start: '05:00:00', end: '22:00:00' };
const WIN = { start: '05:00:00', end: '09:00:00' };
const BF = { start: '05:30:00', end: '08:30:00' };

describe('logging parameters', () => {
  it('education post — full points when on time', () => {
    const r = calculateEducationPost({
      maxPoints: 100,
      educationLogs: [{ CreatedAt: '2026-07-08T07:00:00', Topic: 'Session' }],
      window: EDU,
    });
    assert.equal(r.earnedPoints, 100);
    assert.equal(r.key, 'edu_post');
  });

  it('education post — 0 when late', () => {
    const r = calculateEducationPost({
      maxPoints: 100,
      educationLogs: [{ CreatedAt: '2026-07-08T23:30:00', Topic: 'Session' }],
      window: EDU,
    });
    assert.equal(r.earnedPoints, 0);
    assert.match(r.calculationReason, /Late/i);
  });

  it('education post — ignores smartwatch rows in same table', () => {
    const r = calculateEducationPost({
      maxPoints: 100,
      educationLogs: [{
        CreatedAt: '2026-07-08T23:30:00',
        Topic: 'Calories Burned: 200 kcal',
        Platform: 'Apple Watch',
      }],
      window: EDU,
    });
    assert.equal(r.earnedPoints, 0);
    assert.match(r.calculationReason, /Not completed/i);
  });

  it('education post — scores real education when mixed with smartwatch', () => {
    const r = calculateEducationPost({
      maxPoints: 100,
      educationLogs: [
        {
          CreatedAt: '2026-07-08T07:00:00',
          Topic: 'Calories Burned: 200 kcal',
          Platform: 'Fitbit',
        },
        {
          CreatedAt: '2026-07-08T08:00:00',
          Topic: 'Hydration basics',
          Platform: 'Zoom',
        },
      ],
      window: EDU,
    });
    assert.equal(r.earnedPoints, 100);
  });

  it('weight post — 0 when late', () => {
    const r = calculateWeightPost({
      maxPoints: 100,
      weightRecords: [{ CreatedAt: '2026-07-08T10:00:00', Weight: 70 }],
      window: WIN,
    });
    assert.equal(r.earnedPoints, 0);
  });

  it('breakfast post — full when logged in breakfast window', () => {
    const r = calculateBreakfastPost({
      maxPoints: 100,
      foodRecords: [{ CreatedAt: '2026-07-08T07:00:00', AnalysisData: { foods: [{ name: 'Oats' }] } }],
      window: BF,
    });
    assert.equal(r.earnedPoints, 100);
  });
});

describe('water quantity', () => {
  it('pro-rates below target', () => {
    const r = calculateWater({ maxPoints: 100, consumedMl: 2400, requiredMl: 3000 });
    assert.equal(r.earnedPoints, 80);
  });

  it('full points at or above target', () => {
    const r = calculateWater({ maxPoints: 100, consumedMl: 3100, requiredMl: 3000 });
    assert.equal(r.earnedPoints, 100);
  });
});

describe('nutrition parameters', () => {
  it('calories — proportional below limit (gain mode)', () => {
    const r = calculateCalories({ maxPoints: 100, consumed: 750, limit: 1500, goalMode: 'gain' });
    assert.equal(r.earnedPoints, 50);
  });

  it('calories — full within limit (loss mode)', () => {
    const r = calculateCalories({ maxPoints: 100, consumed: 750, limit: 1500, goalMode: 'loss' });
    assert.equal(r.earnedPoints, 100);
  });

  it('calories — full when no intake within limit (loss mode)', () => {
    const r = calculateCalories({ maxPoints: 100, consumed: 0, limit: 1500, goalMode: 'loss' });
    assert.equal(r.earnedPoints, 100);
  });

  it('calories — 0 when no intake (gain mode)', () => {
    const r = calculateCalories({ maxPoints: 100, consumed: 0, limit: 1500, goalMode: 'gain' });
    assert.equal(r.earnedPoints, 0);
  });

  it('calories — full at limit (gain mode)', () => {
    const r = calculateCalories({ maxPoints: 100, consumed: 1500, limit: 1500, goalMode: 'gain' });
    assert.equal(r.earnedPoints, 100);
  });

  it('calories — 0 when above limit', () => {
    const r = calculateCalories({ maxPoints: 100, consumed: 1600, limit: 1500, goalMode: 'loss' });
    assert.equal(r.earnedPoints, 0);
  });

  it('protein — proportional below target', () => {
    const r = calculateProtein({ maxPoints: 100, consumed: 80, target: 100 });
    assert.equal(r.earnedPoints, 80);
  });

  it('carbohydrates — proportional below limit (gain mode)', () => {
    const r = calculateCarbohydrates({ maxPoints: 100, consumed: 100, limit: 200, goalMode: 'gain' });
    assert.equal(r.earnedPoints, 50);
    assert.equal(r.scoringMode, 'limit');
  });

  it('carbohydrates — full within limit (loss mode)', () => {
    const r = calculateCarbohydrates({ maxPoints: 100, consumed: 100, limit: 200, goalMode: 'loss' });
    assert.equal(r.earnedPoints, 100);
  });

  it('carbohydrates — 0 when above limit', () => {
    const r = calculateCarbohydrates({ maxPoints: 100, consumed: 250, limit: 200, goalMode: 'loss' });
    assert.equal(r.earnedPoints, 0);
  });

  it('fat — full at limit (gain mode)', () => {
    const r = calculateFat({ maxPoints: 100, consumed: 52, limit: 52, goalMode: 'gain' });
    assert.equal(r.earnedPoints, 100);
    assert.equal(r.scoringMode, 'limit');
  });

  it('fat — 0 when above limit', () => {
    const r = calculateFat({ maxPoints: 100, consumed: 60, limit: 52 });
    assert.equal(r.earnedPoints, 0);
  });

  it('sodium — proportional below limit (gain mode)', () => {
    const r = calculateSodium({ maxPoints: 100, consumed: 1150, limit: 2300, goalMode: 'gain' });
    assert.equal(r.earnedPoints, 50);
  });

  it('gi — full for low GI (loss mode)', () => {
    const r = calculateGi({ maxPoints: 100, consumed: 45, limit: 55, goalMode: 'loss' });
    assert.equal(r.earnedPoints, 100);
    assert.match(r.calculationReason, /Low\/medium GI/i);
  });

  it('gi — full for medium GI (loss mode)', () => {
    const r = calculateGi({ maxPoints: 100, consumed: 60, limit: 55, goalMode: 'loss' });
    assert.equal(r.earnedPoints, 100);
  });

  it('gi — 0 for high GI (loss mode)', () => {
    const r = calculateGi({ maxPoints: 100, consumed: 70, limit: 55, goalMode: 'loss' });
    assert.equal(r.earnedPoints, 0);
    assert.match(r.calculationReason, /High GI/i);
  });

  it('gi — full when within limit (gain mode)', () => {
    const r = calculateGi({ maxPoints: 100, consumed: 45, limit: 55, goalMode: 'gain' });
    assert.equal(r.earnedPoints, 100);
  });

  it('gi — 0 when above limit (gain mode)', () => {
    const r = calculateGi({ maxPoints: 100, consumed: 70, limit: 55, goalMode: 'gain' });
    assert.equal(r.earnedPoints, 0);
  });
});

describe('progress parameters', () => {
  it('weight improvement — gain mode progressed', () => {
    const r = calculateWeightImprovement({
      maxPoints: 100,
      currentWeight: 72,
      previousWeight: 70,
      goalMode: 'gain',
    });
    assert.equal(r.earnedPoints, 100);
    assert.equal(r.scoringMode, 'progress');
  });

  it('weight improvement — 0 without previous weight', () => {
    const r = calculateWeightImprovement({
      maxPoints: 100,
      currentWeight: 72,
      previousWeight: null,
      goalMode: 'loss',
    });
    assert.equal(r.earnedPoints, 0);
    assert.equal(r.scoringMode, 'progress');
  });

  it('physical activity — proportional burn', () => {
    const r = calculatePhysicalActivity({ maxPoints: 100, exerciseCalories: 75, bmr: 1500 });
    assert.equal(r.earnedPoints, 50);
  });
});

describe('calculateWellnessScore', () => {
  it('returns 34 individual parameter scores', () => {
    const nutritionTargets = computeNutritionTargets({ bmr: 1500, weightKg: 70 });
    const dailyStats = aggregateDailyFoodStats([
      {
        CreatedAt: '2026-07-08T07:00:00',
        AnalysisData: { foods: [{ name: 'Oats' }] },
        TotalCalories: 400,
        TotalProtein: 20,
        GlycemicIndex: 50,
      },
    ]);

    const r = calculateWellnessScore({
      parameterConfig: DEFAULT_PARAMETER_CONFIG,
      educationLogs: [{ CreatedAt: '2026-07-08T07:00:00', Topic: 'Edu' }],
      weightRecords: [{ CreatedAt: '2026-07-08T06:00:00', Weight: 69 }],
      foodRecords: [{
        CreatedAt: '2026-07-08T07:00:00',
        AnalysisData: { foods: [{ name: 'Oats' }] },
        TotalCalories: 400,
        TotalProtein: 20,
        GlycemicIndex: 50,
      }],
      waterConsumedMl: 3000,
      waterRequiredMl: 3000,
      timeWindows: {
        weight: WIN,
        breakfast: BF,
        lunch: { start: '12:00:00', end: '16:00:00' },
        dinner: { start: '17:30:00', end: '20:30:00' },
        education: EDU,
      },
      dailyStats,
      nutritionTargets,
      currentWeight: 69,
      previousWeight: 70,
      goalMode: 'loss',
      exerciseCalories: 150,
      bmr: 1500,
    });

    assert.equal(r.parameters.length, 34);
    assert.ok(r.totalPossible > 0);
    assert.ok(r.percentage >= 0 && r.percentage <= 100);

    const keys = new Set(r.parameters.map((p) => p.key));
    assert.ok(keys.has('protein'));
    assert.ok(keys.has('vitamin_c'));
    assert.ok(keys.has('physical_activity'));
    assert.equal(keys.has('nutrition'), false);
    assert.equal(keys.has('foodDiary'), false);
  });

  it('sums only enabled parameters', () => {
    const disabled = DEFAULT_PARAMETER_CONFIG.map((p) =>
      p.key === 'calories' ? { ...p, enabled: false } : p,
    );
    const r = calculateWellnessScore({
      parameterConfig: disabled,
      educationLogs: [],
      weightRecords: [],
      foodRecords: [],
      waterConsumedMl: 0,
      waterRequiredMl: 2500,
      timeWindows: { weight: WIN, breakfast: BF, lunch: BF, dinner: BF, education: EDU },
      dailyStats: aggregateDailyFoodStats([]),
      nutritionTargets: computeNutritionTargets({ bmr: 1500, weightKg: 70 }),
      currentWeight: null,
      previousWeight: null,
      goalMode: 'loss',
      exerciseCalories: 0,
      bmr: 1500,
    });
    assert.equal(r.parameters.length, 33);
    assert.ok(!r.parameters.some((p) => p.key === 'calories'));
  });
});
