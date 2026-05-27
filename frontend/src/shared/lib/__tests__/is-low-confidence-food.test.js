import { isLowConfidenceFood } from '../is-low-confidence-food.js';

const goodFood = {
  type: 'food',
  confidence: 0.85,
  details: {
    foods: [{ name: 'rice', calories: 200 }],
    total: { calories: 200 },
  },
};

describe('isLowConfidenceFood', () => {
  it('returns true for null/undefined', () => {
    expect(isLowConfidenceFood(null)).toBe(true);
    expect(isLowConfidenceFood(undefined)).toBe(true);
  });

  it.each(['weight', 'education', 'smartwatch', 'unknown', 'pending'])(
    'returns false when type is %s (non-food types are validated elsewhere)',
    (type) => {
      expect(isLowConfidenceFood({ type, confidence: 0.1 })).toBe(false);
    },
  );

  it('returns true when details.defaulted is true (detector failure)', () => {
    expect(
      isLowConfidenceFood({
        ...goodFood,
        details: { ...goodFood.details, defaulted: true },
      }),
    ).toBe(true);
  });

  it('returns true when confidence < 0.4', () => {
    expect(isLowConfidenceFood({ ...goodFood, confidence: 0.39 })).toBe(true);
    expect(isLowConfidenceFood({ ...goodFood, confidence: 0 })).toBe(true);
  });

  it('returns true when foods array is empty', () => {
    expect(
      isLowConfidenceFood({
        ...goodFood,
        details: { foods: [], total: { calories: 200 } },
      }),
    ).toBe(true);
  });

  it('returns true when total.calories === 0 even with foods listed', () => {
    expect(
      isLowConfidenceFood({
        ...goodFood,
        details: { foods: [{ name: 'mystery' }], total: { calories: 0 } },
      }),
    ).toBe(true);
  });

  it('returns true when total is missing entirely', () => {
    expect(
      isLowConfidenceFood({
        ...goodFood,
        details: { foods: [{ name: 'mystery' }] },
      }),
    ).toBe(true);
  });

  it('returns false for a healthy high-confidence food result', () => {
    expect(isLowConfidenceFood(goodFood)).toBe(false);
  });

  it('returns false at exactly the confidence threshold (0.4)', () => {
    expect(isLowConfidenceFood({ ...goodFood, confidence: 0.4 })).toBe(false);
  });
});
