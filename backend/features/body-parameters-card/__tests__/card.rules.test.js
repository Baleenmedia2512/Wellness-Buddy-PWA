/**
 * card.rules.test.js — Unit tests for pure domain logic.
 * No mocks needed — domain functions are pure.
 */
import {
  isCardShareValid,
  buildProfilePatch,
  buildWeightRecord,
  classifyBmi,
  classifyFatPercent,
} from '../domain/card.rules.js';

describe('isCardShareValid', () => {
  const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const past   = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  it('returns true for a future expiry', () => {
    expect(isCardShareValid(future)).toBe(true);
  });

  it('returns false for a past expiry', () => {
    expect(isCardShareValid(past)).toBe(false);
  });

  it('returns false when expiry is null', () => {
    expect(isCardShareValid(null)).toBe(false);
  });

  it('uses injected clock', () => {
    const fixedNow = new Date('2026-06-01T00:00:00Z');
    expect(isCardShareValid('2026-06-02T00:00:00Z', fixedNow)).toBe(true);
    expect(isCardShareValid('2026-05-31T00:00:00Z', fixedNow)).toBe(false);
  });
});

describe('buildProfilePatch', () => {
  it('includes height and bmr when present', () => {
    const patch = buildProfilePatch({ height_cm: 170, bmr: 1800 });
    expect(patch).toEqual({ height: 170, bmr: 1800 });
  });

  it('passes through nulls for missing fields', () => {
    const patch = buildProfilePatch({ height_cm: null, bmr: null });
    expect(patch).toEqual({ height: null, bmr: null });
  });

  it('never includes body_age', () => {
    const patch = buildProfilePatch({ height_cm: 170, bmr: 1800, body_age: 25 });
    expect(patch).not.toHaveProperty('body_age');
  });
});

describe('buildWeightRecord', () => {
  it('returns null when weight_kg is absent', () => {
    expect(buildWeightRecord({ weight_kg: null }, 1)).toBeNull();
  });

  it('returns a valid row with bmi and fat_percent', () => {
    const row = buildWeightRecord({ weight_kg: 65, bmi: 21, fat_percent: 18, bmr: 1700 }, 5);
    expect(row).toMatchObject({ UserId: 5, Weight: 65, Bmi: 21, BodyFat: 18, Bmr: 1700 });
  });

  it('does not include body_age', () => {
    const row = buildWeightRecord({ weight_kg: 65, body_age: 30 }, 1);
    expect(row).not.toHaveProperty('body_age');
  });
});

describe('classifyBmi', () => {
  it('returns null for null input', () => expect(classifyBmi(null)).toBeNull());
  it('low below 19',   () => expect(classifyBmi(18)).toBe('low'));
  it('normal 19–23',  () => expect(classifyBmi(21)).toBe('normal'));
  it('high above 23', () => expect(classifyBmi(25)).toBe('high'));
  it('normal at boundary 23', () => expect(classifyBmi(23)).toBe('normal'));
});

describe('classifyFatPercent', () => {
  it('returns null for null fat%', () => expect(classifyFatPercent(null, 'Male')).toBeNull());

  it('male: low below 10',   () => expect(classifyFatPercent(8,  'Male')).toBe('low'));
  it('male: normal 10–20',   () => expect(classifyFatPercent(15, 'Male')).toBe('normal'));
  it('male: high above 20',  () => expect(classifyFatPercent(22, 'Male')).toBe('high'));

  it('female: low below 20', () => expect(classifyFatPercent(18, 'Female')).toBe('low'));
  it('female: normal 20–30', () => expect(classifyFatPercent(25, 'Female')).toBe('normal'));
  it('female: high above 30',() => expect(classifyFatPercent(32, 'Female')).toBe('high'));

  it('Other: uses male ranges', () => expect(classifyFatPercent(15, 'Other')).toBe('normal'));
});
