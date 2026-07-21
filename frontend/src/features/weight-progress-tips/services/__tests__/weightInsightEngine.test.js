/**
 * weightInsightEngine.test.js
 * Unit tests for rule-based weight insight reasoning.
 */
import {
  generateWeightInsights,
  determineWeightTrend,
  WEIGHT_INSIGHT_CONFIG,
} from '../weightInsightEngine.js';

describe('determineWeightTrend', () => {
  it('returns first when previous weight is missing', () => {
    expect(determineWeightTrend(null, 75)).toBe('first');
  });

  it('returns stable within tolerance', () => {
    expect(determineWeightTrend(75, 75.1, WEIGHT_INSIGHT_CONFIG)).toBe('stable');
  });

  it('returns increase when above tolerance', () => {
    expect(determineWeightTrend(75, 75.5, WEIGHT_INSIGHT_CONFIG)).toBe('increase');
  });

  it('returns decrease when below tolerance', () => {
    expect(determineWeightTrend(75, 74.5, WEIGHT_INSIGHT_CONFIG)).toBe('decrease');
  });
});

describe('generateWeightInsights — loss mode + weight increased', () => {
  const baseInput = {
    goal: 'loss',
    previousWeight: 75,
    currentWeight: 75.5,
    nutrition: {
      calories: 1000,
      protein: 40,
      carbs: 110,
      fat: 10,
      water: 300,
    },
    targets: {
      calories: 1500,
      protein: 90,
      carbs: 210,
      fat: 40,
      water: 3000,
    },
  };

  it('excludes below-target calories, carbs, and fat', () => {
    const result = generateWeightInsights(baseInput);
    const params = result.reasons.map((r) => r.parameter);

    expect(params).not.toContain('calories');
    expect(params).not.toContain('carbs');
    expect(params).not.toContain('fat');
  });

  it('includes protein and water deficiencies only', () => {
    const result = generateWeightInsights(baseInput);
    const params = result.reasons.map((r) => r.parameter);

    expect(params).toContain('protein');
    expect(params).toContain('water');
    expect(result.reasons.length).toBeLessThanOrEqual(WEIGHT_INSIGHT_CONFIG.maxReasons);
  });

  it('ranks protein above water by impact score', () => {
    const result = generateWeightInsights(baseInput);
    if (result.reasons.length >= 2) {
      expect(result.reasons[0].parameter).toBe('protein');
    }
  });

  it('marks status as reverse_progress', () => {
    const result = generateWeightInsights(baseInput);
    expect(result.status).toBe('reverse_progress');
    expect(result.weightTrend).toBe('increase');
  });
});

describe('generateWeightInsights — loss mode + weight decreased', () => {
  it('shows positive contributors only', () => {
    const result = generateWeightInsights({
      goal: 'loss',
      previousWeight: 76,
      currentWeight: 75,
      nutrition: { calories: 1200, protein: 95, carbs: 150, fat: 35, water: 2500 },
      targets: { calories: 1500, protein: 90, carbs: 210, fat: 40, water: 3000 },
    });

    expect(result.status).toBe('favorable_progress');
    expect(result.reasons.every((r) => r.displayVariant === 'positive')).toBe(true);
    expect(result.reasons.map((r) => r.parameter)).not.toContain('carbs');
    expect(result.reasons.map((r) => r.parameter)).not.toContain('fat');
  });
});

describe('generateWeightInsights — gain mode + weight decreased', () => {
  it('includes under-target macros as reasons', () => {
    const result = generateWeightInsights({
      goal: 'gain',
      previousWeight: 70,
      currentWeight: 69.5,
      nutrition: { calories: 1800, protein: 50, carbs: 180, fat: 45, water: 1500 },
      targets: { calories: 2500, protein: 120, carbs: 300, fat: 80, water: 3000 },
    });

    expect(result.status).toBe('reverse_progress');
    expect(result.reasons.length).toBeGreaterThan(0);
    expect(result.reasons.some((r) => r.displayVariant === 'deficit')).toBe(true);
  });
});

describe('generateWeightInsights — edge cases', () => {
  it('handles first upload with no reasons', () => {
    const result = generateWeightInsights({
      goal: 'loss',
      previousWeight: null,
      currentWeight: 75,
      nutrition: {},
      targets: {},
    });

    expect(result.status).toBe('first_upload');
    expect(result.reasons).toHaveLength(0);
  });

  it('handles missing targets without crashing', () => {
    const result = generateWeightInsights({
      goal: 'loss',
      previousWeight: 75,
      currentWeight: 76,
      nutrition: { calories: 2000, protein: 50, carbs: 200, fat: 60, water: 500 },
      targets: {},
    });

    expect(result.reasons).toHaveLength(0);
  });

  it('returns empty message when no reasons match', () => {
    const result = generateWeightInsights({
      goal: 'loss',
      previousWeight: 75,
      currentWeight: 75.5,
      nutrition: { calories: 1200, protein: 95, carbs: 180, fat: 35, water: 2800 },
      targets: { calories: 1500, protein: 90, carbs: 210, fat: 40, water: 3000 },
    });

    expect(result.reasons).toHaveLength(0);
    expect(result.emptyMessage).toMatch(/No significant nutrition-related contributors/);
  });

  it('uses cautious language in explanations', () => {
    const result = generateWeightInsights({
      goal: 'loss',
      previousWeight: 75,
      currentWeight: 75.5,
      nutrition: { calories: 1000, protein: 40, carbs: 110, fat: 10, water: 300 },
      targets: { calories: 1500, protein: 90, carbs: 210, fat: 40, water: 3000 },
    });

    result.reasons.forEach((reason) => {
      expect(reason.explanation).toMatch(/possible|likely|may have/i);
    });
  });
});
