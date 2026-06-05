import {
  detectContactType,
  normalizePhone,
  isValidEmail,
  isValidPhoneE164,
  COUNTRY_CODES,
  DEFAULT_COUNTRY,
} from '../domain/contactIdentifier';

describe('detectContactType', () => {
  it.each([
    ['user@example.com', 'email'],
    ['UPPER@DOMAIN.io', 'email'],
    ['@', 'email'],          // anything with @ goes to email branch
    ['+919876543210', 'phone'],
    ['9876543210', 'phone'],
    ['98765-43210', 'phone'],
    ['98 765 43210', 'phone'],
    ['(987) 654-3210', 'phone'],
  ])('classifies %s → %s', (input, expected) => {
    expect(detectContactType(input)).toBe(expected);
  });

  it.each([['', 'unknown'], ['   ', 'unknown'], ['abc', 'unknown']])(
    'returns unknown for %j', (input, expected) => {
      expect(detectContactType(input)).toBe(expected);
    });

  it('handles null / undefined safely', () => {
    expect(detectContactType(null)).toBe('unknown');
    expect(detectContactType(undefined)).toBe('unknown');
  });
});

describe('isValidEmail', () => {
  it.each([
    'user@example.com',
    'first.last+tag@sub.example.co.uk',
    'TEST@EXAMPLE.IO',
  ])('accepts %s', (e) => expect(isValidEmail(e)).toBe(true));

  it.each(['', 'no-at-sign', 'foo@', '@bar', 'foo@bar', 'foo @bar.com'])(
    'rejects %j', (e) => expect(isValidEmail(e)).toBe(false));
});

describe('normalizePhone', () => {
  it('prepends India dial code by default', () => {
    expect(normalizePhone('9876543210')).toBe('+919876543210');
  });

  it('respects an explicit + prefix and ignores country code', () => {
    expect(normalizePhone('+14155551234', '+91')).toBe('+14155551234');
  });

  it('strips spaces, dashes, parens before composing', () => {
    expect(normalizePhone('(987) 654-3210', '+91')).toBe('+919876543210');
    expect(normalizePhone(' 98 76 54 32 10 ', '+91')).toBe('+919876543210');
  });

  it.each([
    ['', '+91'],         // empty input
    ['abc', '+91'],      // no digits
    ['+12', '+91'],      // too short
    ['1', '+91'],        // single digit + IN code = 4 chars, < 8 minimum
    ['9876543210', ''],  // empty dial code
    ['9876543210', '91'],// dial code missing leading +
  ])('returns "" for invalid input (%j, %j)', (raw, dial) => {
    expect(normalizePhone(raw, dial)).toBe('');
  });

  it('handles null / undefined safely', () => {
    expect(normalizePhone(null)).toBe('');
    expect(normalizePhone(undefined, '+91')).toBe('');
  });
});

describe('isValidPhoneE164', () => {
  it('accepts +-prefixed 8-15 digit strings', () => {
    expect(isValidPhoneE164('+919876543210')).toBe(true);
    expect(isValidPhoneE164('+14155551234')).toBe(true);
  });

  it('rejects malformed values', () => {
    expect(isValidPhoneE164('919876543210')).toBe(false); // no +
    expect(isValidPhoneE164('+abc')).toBe(false);
    expect(isValidPhoneE164('+1234567')).toBe(false);     // 7 digits, < 8
    expect(isValidPhoneE164('')).toBe(false);
    expect(isValidPhoneE164(null)).toBe(false);
  });
});

describe('COUNTRY_CODES + DEFAULT_COUNTRY', () => {
  it('defaults to India', () => {
    expect(DEFAULT_COUNTRY.code).toBe('IN');
    expect(DEFAULT_COUNTRY.dial).toBe('+91');
  });

  it('every entry has a valid E.164 dial code', () => {
    COUNTRY_CODES.forEach((c) => {
      expect(c.dial).toMatch(/^\+\d{1,4}$/);
      expect(c.code).toMatch(/^[A-Z]{2}$/);
      expect(typeof c.name).toBe('string');
    });
  });
});
