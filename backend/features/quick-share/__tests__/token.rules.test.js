import {
  generateToken,
  computeExpiry,
  isExpired,
  DEFAULT_EXPIRY_MS,
} from '../domain/token.rules.js';

describe('quick-share token.rules', () => {
  it('generateToken returns a v4 UUID', () => {
    const t = generateToken();
    expect(t).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('two tokens are not equal', () => {
    expect(generateToken()).not.toBe(generateToken());
  });

  it('computeExpiry defaults to 30 days from now', () => {
    const now = 1_700_000_000_000;
    const iso = computeExpiry(now);
    expect(new Date(iso).getTime()).toBe(now + DEFAULT_EXPIRY_MS);
  });

  it('computeExpiry honours a custom expiry', () => {
    const now = 1_700_000_000_000;
    const iso = computeExpiry(now, 60_000);
    expect(new Date(iso).getTime()).toBe(now + 60_000);
  });

  describe('isExpired', () => {
    const now = 1_700_000_000_000;

    it('returns false for a future expiry', () => {
      expect(isExpired(new Date(now + 1000).toISOString(), now)).toBe(false);
    });

    it('returns true for an expiry in the past', () => {
      expect(isExpired(new Date(now - 1000).toISOString(), now)).toBe(true);
    });

    it('returns true when expiry equals now (boundary fail-closed)', () => {
      expect(isExpired(new Date(now).toISOString(), now)).toBe(true);
    });

    it('returns true for null / undefined (fail-closed)', () => {
      expect(isExpired(null, now)).toBe(true);
      expect(isExpired(undefined, now)).toBe(true);
    });

    it('returns true for an unparseable string', () => {
      expect(isExpired('not-a-date', now)).toBe(true);
    });

    it('accepts a Date instance', () => {
      expect(isExpired(new Date(now + 1000), now)).toBe(false);
    });
  });
});
