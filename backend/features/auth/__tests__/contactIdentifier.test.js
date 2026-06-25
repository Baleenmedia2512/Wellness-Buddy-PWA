import {
  detectContactType,
  isValidEmail,
  isValidPhoneE164,
  usernameFromPhone,
} from '../domain/contactIdentifier.js';

describe('detectContactType', () => {
  it.each([
    ['user@example.com', 'email'],
    ['+919876543210', 'phone'],
    ['9876543210', 'phone'],
  ])('classifies %s → %s', (input, expected) => {
    expect(detectContactType(input)).toBe(expected);
  });

  it('returns unknown for empty / nonsense input', () => {
    expect(detectContactType('')).toBe('unknown');
    expect(detectContactType('abc')).toBe('unknown');
    expect(detectContactType(null)).toBe('unknown');
  });
});

describe('isValidEmail', () => {
  it('accepts well-formed addresses', () => {
    expect(isValidEmail('a@b.co')).toBe(true);
    expect(isValidEmail('UPPER@DOMAIN.IO')).toBe(true);
  });

  it('rejects malformed', () => {
    expect(isValidEmail('no-at')).toBe(false);
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail(null)).toBe(false);
  });
});

describe('isValidPhoneE164', () => {
  it('accepts 8-15 digit + prefixed strings', () => {
    expect(isValidPhoneE164('+919876543210')).toBe(true);
    expect(isValidPhoneE164('+14155551234')).toBe(true);
  });

  it('rejects malformed', () => {
    expect(isValidPhoneE164('919876543210')).toBe(false);
    expect(isValidPhoneE164('+1234567')).toBe(false);
    expect(isValidPhoneE164('')).toBe(false);
    expect(isValidPhoneE164(null)).toBe(false);
  });
});

describe('usernameFromPhone', () => {
  it('produces a stable digits-only username', () => {
    expect(usernameFromPhone('+919876543210')).toBe('user_919876543210');
    expect(usernameFromPhone('+1 (415) 555-1234')).toBe('user_14155551234');
  });

  it('returns empty for invalid input', () => {
    expect(usernameFromPhone('')).toBe('');
    expect(usernameFromPhone(null)).toBe('');
    expect(usernameFromPhone('++')).toBe('');
  });
});
