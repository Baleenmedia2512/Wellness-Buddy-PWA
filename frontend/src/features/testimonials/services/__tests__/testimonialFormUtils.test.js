import {
  formatDurationText,
  validateDurationFields,
  validateWeightKg,
} from '../testimonialFormUtils.js';

describe('validateWeightKg', () => {
  it('rejects empty and zero', () => {
    expect(validateWeightKg('', 'Before weight')).toMatch(/required/i);
    expect(validateWeightKg('0', 'Before weight')).toMatch(/between 1 and 500/i);
  });

  it('accepts valid weights', () => {
    expect(validateWeightKg('72.5', 'Before weight')).toBeNull();
    expect(validateWeightKg('1', 'Before weight')).toBeNull();
    expect(validateWeightKg('500', 'Before weight')).toBeNull();
  });

  it('rejects out of range', () => {
    expect(validateWeightKg('501', 'Before weight')).toMatch(/between 1 and 500/i);
  });
});

describe('validateDurationFields', () => {
  it('rejects empty and zero', () => {
    expect(validateDurationFields('months', '')).toMatch(/required/i);
    expect(validateDurationFields('months', '0')).toMatch(/at least 1/i);
  });

  it('accepts valid duration', () => {
    expect(validateDurationFields('months', '3')).toBeNull();
    expect(validateDurationFields('days', '14')).toBeNull();
  });
});

describe('formatDurationText', () => {
  it('returns empty string when invalid', () => {
    expect(formatDurationText('months', '0')).toBe('');
    expect(formatDurationText('months', '')).toBe('');
  });

  it('builds normalized duration text', () => {
    expect(formatDurationText('months', '3')).toBe('3 months');
    expect(formatDurationText('days', '30')).toBe('30 days');
  });
});
