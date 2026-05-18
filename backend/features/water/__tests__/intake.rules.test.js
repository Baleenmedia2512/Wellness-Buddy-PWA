/**
 * Unit tests for the pure water-intake domain rules.
 * No mocks needed — everything is pure inputs → outputs.
 *
 * Coverage target: ≥ 95 % lines / ≥ 90 % branches (claude.md §9.1).
 */
import {
  DEFAULT_REQUIRED_ML,
  computeRequiredMl,
  parseAnalysisData,
  extractWaterFromRecord,
  computeDailyIntake,
} from '../domain/intake.rules.js';

describe('computeRequiredMl', () => {
  it('uses 50 ml/kg for a valid weight', () => {
    expect(computeRequiredMl(70)).toEqual({
      weightKg: 70,
      defaultWeight: false,
      requiredMl: 3500,
    });
  });

  it('parses string weights', () => {
    expect(computeRequiredMl('60.5').requiredMl).toBe(3025);
  });

  it.each([null, undefined, '', 'abc', 0, -10, NaN])(
    'falls back to DEFAULT_REQUIRED_ML for invalid weight %p',
    (w) => {
      const r = computeRequiredMl(w);
      expect(r.requiredMl).toBe(DEFAULT_REQUIRED_ML);
      expect(r.defaultWeight).toBe(true);
      expect(r.weightKg).toBeNull();
    },
  );
});

describe('parseAnalysisData', () => {
  it('returns the object when already an object', () => {
    const obj = { foods: [{ name: 'water' }] };
    expect(parseAnalysisData(obj)).toBe(obj);
  });

  it('parses a JSON string', () => {
    expect(parseAnalysisData('{"foods":[]}')).toEqual({ foods: [] });
  });

  it.each([null, undefined, 42, true])('returns null for non-object %p', (v) => {
    expect(parseAnalysisData(v)).toBeNull();
  });

  it('returns null on malformed JSON', () => {
    expect(parseAnalysisData('not-json')).toBeNull();
  });
});

describe('extractWaterFromRecord', () => {
  it('sums volume_ml across exempted foods only', () => {
    const record = {
      CreatedAt: '2026-05-18T08:00:00',
      AnalysisData: {
        foods: [
          { name: 'water', volume_ml: 250 },
          { name: 'green tea', volume_ml: 200 },
          { name: 'pizza', volume_ml: 999 }, // ignored — not exempted
        ],
      },
    };
    const { recordMl, items } = extractWaterFromRecord(record);
    expect(recordMl).toBe(450);
    expect(items).toEqual([
      { name: 'water', volumeMl: 250 },
      { name: 'green tea', volumeMl: 200 },
    ]);
  });

  it('falls back to weight_g then estimatedWeight when volume_ml missing', () => {
    const { recordMl } = extractWaterFromRecord({
      CreatedAt: 'x',
      AnalysisData: {
        foods: [
          { name: 'water', weight_g: 100 },
          { name: 'water', estimatedWeight: 50 },
        ],
      },
    });
    expect(recordMl).toBe(150);
  });

  it('returns zero for records with no foods', () => {
    expect(extractWaterFromRecord({ CreatedAt: 'x', AnalysisData: {} })).toEqual({
      recordMl: 0,
      items: [],
    });
  });

  it('returns zero for unparseable AnalysisData', () => {
    expect(
      extractWaterFromRecord({ CreatedAt: 'x', AnalysisData: 'garbage' }),
    ).toEqual({ recordMl: 0, items: [] });
  });
});

describe('computeDailyIntake', () => {
  const baseArgs = {
    userId: '42',
    date: '2026-05-18',
    latestWeightKg: 70, // → 3500 ml required
  };

  it('aggregates multiple water records with weight-based target', () => {
    const result = computeDailyIntake({
      ...baseArgs,
      foodRows: [
        {
          CreatedAt: '2026-05-18T07:00:00',
          AnalysisData: { foods: [{ name: 'water', volume_ml: 1000 }] },
        },
        {
          CreatedAt: '2026-05-18T12:00:00',
          AnalysisData: { foods: [{ name: 'green tea', volume_ml: 500 }] },
        },
      ],
    });

    expect(result).toMatchObject({
      date: '2026-05-18',
      userId: 42,
      weightKg: 70,
      defaultWeight: false,
      requiredMl: 3500,
      totalMl: 1500,
      remainingMl: 2000,
      achieved: false,
      progressPercent: 43,
      logCount: 2,
    });
    expect(result.logs).toHaveLength(2);
  });

  it('marks achieved=true and caps progressPercent at 100', () => {
    const result = computeDailyIntake({
      ...baseArgs,
      foodRows: [
        {
          CreatedAt: 'x',
          AnalysisData: { foods: [{ name: 'water', volume_ml: 9999 }] },
        },
      ],
    });
    expect(result.achieved).toBe(true);
    expect(result.progressPercent).toBe(100);
    expect(result.remainingMl).toBe(0);
  });

  it('skips non-beverage records via isExemptedBeverageOnly', () => {
    const result = computeDailyIntake({
      ...baseArgs,
      foodRows: [
        {
          CreatedAt: 'x',
          AnalysisData: {
            foods: [
              { name: 'water', volume_ml: 300 },
              { name: 'pizza', weight_g: 400 }, // mixed → record dropped entirely
            ],
          },
        },
      ],
    });
    expect(result.totalMl).toBe(0);
    expect(result.logCount).toBe(0);
  });

  it('uses DEFAULT_REQUIRED_ML when latestWeightKg is missing', () => {
    const result = computeDailyIntake({
      ...baseArgs,
      latestWeightKg: null,
      foodRows: [],
    });
    expect(result.requiredMl).toBe(DEFAULT_REQUIRED_ML);
    expect(result.defaultWeight).toBe(true);
    expect(result.weightKg).toBeNull();
  });

  it('treats null foodRows as empty', () => {
    const result = computeDailyIntake({ ...baseArgs, foodRows: null });
    expect(result.totalMl).toBe(0);
    expect(result.logs).toEqual([]);
  });
});
