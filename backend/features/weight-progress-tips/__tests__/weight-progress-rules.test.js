/**
 * weight-progress-rules.test.js
 * Unit tests for the weight-progress-tips domain layer.
 *
 * Pure domain — no mocks, no I/O. Inputs in → outputs verified.
 */
import {
  checkReverseProgress,
  generateTips,
  calculateWaterTarget,
  computeCalorieTarget,
  computeProteinTarget,
} from '../domain/weight-progress-rules.js';

// ─────────────────────────────────────────────────────────────────────────────
// checkReverseProgress
// ─────────────────────────────────────────────────────────────────────────────
describe('checkReverseProgress', () => {
  describe('loss mode', () => {
    it('returns hasReverseProgress=true when weight increased beyond threshold', () => {
      const result = checkReverseProgress({
        currentWeight: 75.5,
        previousWeight: 75.0,
        goalMode: 'loss',
      });
      expect(result.hasReverseProgress).toBe(true);
      expect(result.direction).toBe('increased');
      expect(result.change).toBeCloseTo(0.5, 1);
    });

    it('returns hasReverseProgress=false when weight decreased (favorable)', () => {
      const result = checkReverseProgress({
        currentWeight: 74.5,
        previousWeight: 75.0,
        goalMode: 'loss',
      });
      expect(result.hasReverseProgress).toBe(false);
      expect(result.direction).toBe('favorable');
    });

    it('returns reverse progress for any weight increase in loss mode', () => {
      const result = checkReverseProgress({
        currentWeight: 75.2,
        previousWeight: 75.0,
        goalMode: 'loss',
      });
      expect(result.hasReverseProgress).toBe(true);
      expect(result.direction).toBe('increased');
    });

    it('returns neutral when weight is unchanged', () => {
      const result = checkReverseProgress({
        currentWeight: 75.0,
        previousWeight: 75.0,
        goalMode: 'loss',
      });
      expect(result.hasReverseProgress).toBe(false);
      expect(result.direction).toBe('neutral');
    });
  });

  describe('gain mode', () => {
    it('returns hasReverseProgress=true when weight decreased beyond threshold', () => {
      const result = checkReverseProgress({
        currentWeight: 69.5,
        previousWeight: 70.0,
        goalMode: 'gain',
      });
      expect(result.hasReverseProgress).toBe(true);
      expect(result.direction).toBe('decreased');
      expect(result.change).toBeCloseTo(0.5, 1);
    });

    it('returns hasReverseProgress=false when weight increased (favorable)', () => {
      const result = checkReverseProgress({
        currentWeight: 70.5,
        previousWeight: 70.0,
        goalMode: 'gain',
      });
      expect(result.hasReverseProgress).toBe(false);
      expect(result.direction).toBe('favorable');
    });
  });

  describe('edge cases', () => {
    it('returns no reverse progress when inputs are missing', () => {
      expect(checkReverseProgress({}).hasReverseProgress).toBe(false);
      expect(checkReverseProgress({ currentWeight: 70 }).hasReverseProgress).toBe(false);
      expect(checkReverseProgress({ currentWeight: 70, previousWeight: 69 }).hasReverseProgress).toBe(false);
    });

    it('returns neutral for exact same weight (0 change)', () => {
      const result = checkReverseProgress({
        currentWeight: 70.0,
        previousWeight: 70.0,
        goalMode: 'loss',
      });
      expect(result.hasReverseProgress).toBe(false);
      expect(result.direction).toBe('neutral');
    });

    it('handles string values gracefully (parsed from API)', () => {
      const result = checkReverseProgress({
        currentWeight: '75.5',
        previousWeight: '75.0',
        goalMode: 'loss',
      });
      expect(result.hasReverseProgress).toBe(true);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// computeCalorieTarget
// ─────────────────────────────────────────────────────────────────────────────
describe('computeCalorieTarget', () => {
  it('applies 15% deficit for loss mode', () => {
    expect(computeCalorieTarget(2000, 'loss')).toBe(1700);
  });

  it('applies 15% surplus for gain mode', () => {
    expect(computeCalorieTarget(2000, 'gain')).toBe(2300);
  });

  it('returns BMR unchanged for maintain mode', () => {
    expect(computeCalorieTarget(2000, 'maintain')).toBe(2000);
  });

  it('returns 0 when BMR is null or 0', () => {
    expect(computeCalorieTarget(null, 'loss')).toBe(0);
    expect(computeCalorieTarget(0, 'loss')).toBe(0);
  });

  it('returns 0 when BMR is NaN', () => {
    expect(computeCalorieTarget('abc', 'loss')).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// computeProteinTarget
// ─────────────────────────────────────────────────────────────────────────────
describe('computeProteinTarget', () => {
  it('computes 1.2 g per kg', () => {
    expect(computeProteinTarget(70)).toBe(84);
    expect(computeProteinTarget(80)).toBe(96);
  });

  it('returns 0 for invalid weight', () => {
    expect(computeProteinTarget(null)).toBe(0);
    expect(computeProteinTarget(0)).toBe(0);
    expect(computeProteinTarget(-10)).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// calculateWaterTarget
// ─────────────────────────────────────────────────────────────────────────────
describe('calculateWaterTarget', () => {
  it('returns weight / 20 * 1000 ml', () => {
    expect(calculateWaterTarget(70)).toBe(3500);
    expect(calculateWaterTarget(60)).toBe(3000);
  });

  it('returns 2000 ml default for missing or invalid weight', () => {
    expect(calculateWaterTarget(null)).toBe(2000);
    expect(calculateWaterTarget(0)).toBe(2000);
    expect(calculateWaterTarget(-1)).toBe(2000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// generateTips
// ─────────────────────────────────────────────────────────────────────────────

const BASE_INPUT = {
  yesterdayNutrition: { calories: 1500, protein: 80, carbs: 150, fat: 50 },
  waterYesterday: 3000,
  waterTarget: 3500,
  calorieTarget: 1700,
  proteinTarget: 84,
  goalMode: 'loss',
  weightChange: 0.5,
  activityYesterday: { steps: 8000, caloriesBurned: 300, activityType: 'walking' },
};

describe('generateTips — loss mode', () => {
  it('generates high-priority calorie tip when calories exceed target by >100', () => {
    const input = {
      ...BASE_INPUT,
      yesterdayNutrition: { ...BASE_INPUT.yesterdayNutrition, calories: 1900 },
      calorieTarget: 1700,
    };
    const tips = generateTips(input);
    const calTip = tips.find((t) => t.icon === '🔥');
    expect(calTip).toBeDefined();
    expect(calTip.priority).toBe('high');
    expect(calTip.message).toContain('1900');
    expect(calTip.message).toContain('1700');
  });

  it('does not generate calorie tip when within 100 kcal of target', () => {
    const input = { ...BASE_INPUT, calorieTarget: 1500 };
    const tips = generateTips(input);
    expect(tips.find((t) => t.icon === '🔥')).toBeUndefined();
  });

  it('generates protein tip when protein is below 80% of target', () => {
    const input = {
      ...BASE_INPUT,
      yesterdayNutrition: { ...BASE_INPUT.yesterdayNutrition, protein: 50 },
      proteinTarget: 84,
    };
    const tips = generateTips(input);
    const proteinTip = tips.find((t) => t.icon === '🥩');
    expect(proteinTip).toBeDefined();
    expect(proteinTip.message).toContain('50');
    expect(proteinTip.message).toContain('84');
  });

  it('generates carb tip when carbs exceed 200g in loss mode', () => {
    const input = {
      ...BASE_INPUT,
      yesterdayNutrition: { ...BASE_INPUT.yesterdayNutrition, carbs: 250 },
    };
    const tips = generateTips(input);
    expect(tips.find((t) => t.icon === '🍞')).toBeDefined();
  });

  it('generates fat tip when fat exceeds 70g in loss mode', () => {
    const input = {
      ...BASE_INPUT,
      yesterdayNutrition: { ...BASE_INPUT.yesterdayNutrition, fat: 80 },
    };
    const tips = generateTips(input);
    expect(tips.find((t) => t.icon === '🥑')).toBeDefined();
  });

  it('generates water tip when yesterday water was below 80% of target', () => {
    const input = { ...BASE_INPUT, waterYesterday: 2000, waterTarget: 3500 };
    const tips = generateTips(input);
    expect(tips.find((t) => t.icon === '💧')).toBeDefined();
  });

  it('generates "no water recorded" tip when waterYesterday is 0', () => {
    const input = { ...BASE_INPUT, waterYesterday: 0, waterTarget: 3500 };
    const tips = generateTips(input);
    const waterTip = tips.find((t) => t.icon === '💧');
    expect(waterTip).toBeDefined();
    expect(waterTip.message).toContain('No');
  });

  it('does NOT generate water tip when hydration is adequate', () => {
    const input = { ...BASE_INPUT, waterYesterday: 3500, waterTarget: 3500 };
    const tips = generateTips(input);
    expect(tips.find((t) => t.icon === '💧')).toBeUndefined();
  });

  it('generates activity tip when steps are below 5000', () => {
    const input = { ...BASE_INPUT, activityYesterday: { steps: 2000, caloriesBurned: 80, activityType: 'walking' } };
    const tips = generateTips(input);
    expect(tips.find((t) => t.icon === '🏃')).toBeDefined();
  });

  it('generates "no activity" tip when steps are 0', () => {
    const input = { ...BASE_INPUT, activityYesterday: { steps: 0, caloriesBurned: 0, activityType: null } };
    const tips = generateTips(input);
    const activityTip = tips.find((t) => t.icon === '🏃');
    expect(activityTip).toBeDefined();
    expect(activityTip.message).toContain('No physical activity');
  });

  it('does NOT generate activity tip when steps are sufficient', () => {
    const input = { ...BASE_INPUT, activityYesterday: { steps: 9000, caloriesBurned: 350, activityType: 'running' } };
    const tips = generateTips(input);
    expect(tips.find((t) => t.icon === '🏃')).toBeUndefined();
  });
});

describe('generateTips — gain mode', () => {
  it('generates high-priority calorie tip when calories are below gain target', () => {
    const input = {
      ...BASE_INPUT,
      goalMode: 'gain',
      calorieTarget: 2300,
      yesterdayNutrition: { ...BASE_INPUT.yesterdayNutrition, calories: 1800 },
    };
    const tips = generateTips(input);
    const calTip = tips.find((t) => t.icon === '🔥');
    expect(calTip).toBeDefined();
    expect(calTip.priority).toBe('high');
    expect(calTip.message).toContain('only');
  });

  it('marks protein tip as high priority in gain mode', () => {
    const input = {
      ...BASE_INPUT,
      goalMode: 'gain',
      proteinTarget: 100,
      yesterdayNutrition: { ...BASE_INPUT.yesterdayNutrition, protein: 60 },
    };
    const tips = generateTips(input);
    const proteinTip = tips.find((t) => t.icon === '🥩');
    expect(proteinTip?.priority).toBe('high');
  });

  it('does NOT generate carb tip in gain mode even with high carbs', () => {
    const input = {
      ...BASE_INPUT,
      goalMode: 'gain',
      yesterdayNutrition: { ...BASE_INPUT.yesterdayNutrition, carbs: 300 },
    };
    const tips = generateTips(input);
    expect(tips.find((t) => t.icon === '🍞')).toBeUndefined();
  });
});

describe('generateTips — edge cases', () => {
  it('returns a fallback tip when no issues detected', () => {
    const perfectInput = {
      yesterdayNutrition: { calories: 1700, protein: 85, carbs: 150, fat: 60 },
      waterYesterday: 3600,
      waterTarget: 3500,
      calorieTarget: 1700,
      proteinTarget: 84,
      goalMode: 'loss',
      weightChange: 0.5,
      activityYesterday: { steps: 9000, caloriesBurned: 350, activityType: 'running' },
    };
    const tips = generateTips(perfectInput);
    expect(tips.length).toBeGreaterThan(0);
    expect(tips[0].priority).toBe('low');
  });

  it('returns sorted tips: high before medium before low', () => {
    const input = {
      ...BASE_INPUT,
      yesterdayNutrition: { calories: 2000, protein: 40, carbs: 250, fat: 80 },
      waterYesterday: 500,
      waterTarget: 3500,
      activityYesterday: { steps: 1000, caloriesBurned: 50, activityType: null },
    };
    const tips = generateTips(input);
    const priorities = tips.map((t) => t.priority);
    const priorityOrder = { high: 1, medium: 2, low: 3 };
    for (let i = 1; i < priorities.length; i++) {
      expect(priorityOrder[priorities[i]]).toBeGreaterThanOrEqual(priorityOrder[priorities[i - 1]]);
    }
  });

  it('handles null activityYesterday gracefully', () => {
    const input = { ...BASE_INPUT, activityYesterday: null };
    const tips = generateTips(input);
    const activityTip = tips.find((t) => t.icon === '🏃');
    expect(activityTip).toBeDefined();
  });

  it('skips calorie tip when calorieTarget is 0 (no BMR available)', () => {
    const input = { ...BASE_INPUT, calorieTarget: 0 };
    const tips = generateTips(input);
    expect(tips.find((t) => t.icon === '🔥')).toBeUndefined();
  });

  it('skips protein tip when proteinTarget is 0 (no weight available)', () => {
    const input = {
      ...BASE_INPUT,
      proteinTarget: 0,
      yesterdayNutrition: { ...BASE_INPUT.yesterdayNutrition, protein: 20 },
    };
    const tips = generateTips(input);
    expect(tips.find((t) => t.icon === '🥩')).toBeUndefined();
  });
});
