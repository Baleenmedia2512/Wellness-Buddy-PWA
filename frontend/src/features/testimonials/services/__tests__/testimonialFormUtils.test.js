import {
  formatDurationText,
  validateDurationFields,
  validateWeightKg,
  sanitizeWeightTyping,
  parseWeightKg,
  PORTRAIT_IMAGE_CLASS,
  PORTRAIT_IMAGE_CLASS_SM,
} from '../testimonialFormUtils.js';

describe('validateWeightKg', () => {
  it('rejects empty and zero', () => {
    expect(validateWeightKg('', 'Before weight')).toMatch(/required/i);
    expect(validateWeightKg('0', 'Before weight')).toMatch(/between 1 and 500/i);
  });

  it('accepts valid weights including decimals', () => {
    expect(validateWeightKg('72.5', 'Before weight')).toBeNull();
    expect(validateWeightKg('72,5', 'Before weight')).toBeNull();
    expect(validateWeightKg('1', 'Before weight')).toBeNull();
    expect(validateWeightKg('500', 'Before weight')).toBeNull();
  });

  it('rejects out of range', () => {
    expect(validateWeightKg('501', 'Before weight')).toMatch(/between 1 and 500/i);
  });
});

describe('sanitizeWeightTyping / parseWeightKg', () => {
  it('preserves in-progress decimal typing', () => {
    expect(sanitizeWeightTyping('72.')).toBe('72.');
    expect(sanitizeWeightTyping('72,')).toBe('72.');
    expect(sanitizeWeightTyping('72.5')).toBe('72.5');
    expect(sanitizeWeightTyping('72.55')).toBe('72.55');
    expect(sanitizeWeightTyping('72.555')).toBe('72.55');
  });

  it('parses decimal and comma weights', () => {
    expect(parseWeightKg('72.5')).toBe(72.5);
    expect(parseWeightKg('72,5')).toBe(72.5);
    expect(parseWeightKg('72.')).toBe(72);
    expect(parseWeightKg('')).toBeNull();
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

describe('portrait frame classes', () => {
  it('fills the 9:16 frame with cover, top-anchored so faces are not cropped', () => {
    expect(PORTRAIT_IMAGE_CLASS).toMatch(/aspect-\[9\/16\]/);
    expect(PORTRAIT_IMAGE_CLASS).toMatch(/object-cover/);
    expect(PORTRAIT_IMAGE_CLASS).toMatch(/object-top/);
    expect(PORTRAIT_IMAGE_CLASS).not.toMatch(/object-contain/);
    expect(PORTRAIT_IMAGE_CLASS).not.toMatch(/object-center/);
    expect(PORTRAIT_IMAGE_CLASS_SM).toMatch(/object-cover/);
    expect(PORTRAIT_IMAGE_CLASS_SM).toMatch(/object-top/);
    expect(PORTRAIT_IMAGE_CLASS_SM).not.toMatch(/object-contain/);
    expect(PORTRAIT_IMAGE_CLASS_SM).not.toMatch(/object-center/);
  });
});
