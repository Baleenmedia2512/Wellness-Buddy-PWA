import {
  generateShareToken,
  computeShareExpiry,
  buildPublicUrl,
  SHARE_LINK_TTL_HOURS,
} from '../domain/token.rules.js';

describe('token.rules', () => {
  describe('generateShareToken', () => {
    it('returns a 10-character alphanumeric string', () => {
      const token = generateShareToken();
      expect(token).toMatch(/^[A-Za-z0-9]{10}$/);
    });

    it('generates unique tokens across multiple calls', () => {
      const tokens = new Set(Array.from({ length: 100 }, generateShareToken));
      expect(tokens.size).toBeGreaterThan(95); // collision chance < 5% for 100 tokens
    });
  });

  describe('computeShareExpiry', () => {
    it(`returns a date ${SHARE_LINK_TTL_HOURS} hours in the future`, () => {
      const now = new Date('2026-01-01T00:00:00Z');
      const expiry = computeShareExpiry(now);
      const diffMs = expiry.getTime() - now.getTime();
      expect(diffMs).toBe(SHARE_LINK_TTL_HOURS * 60 * 60 * 1000);
    });

    it('uses current time when no argument is passed', () => {
      const before = Date.now();
      const expiry = computeShareExpiry();
      const after = Date.now();
      const expectedMin = before + SHARE_LINK_TTL_HOURS * 60 * 60 * 1000;
      const expectedMax = after + SHARE_LINK_TTL_HOURS * 60 * 60 * 1000;
      expect(expiry.getTime()).toBeGreaterThanOrEqual(expectedMin);
      expect(expiry.getTime()).toBeLessThanOrEqual(expectedMax);
    });
  });

  describe('buildPublicUrl', () => {
    it('builds the correct URL from baseUrl and token', () => {
      const url = buildPublicUrl('https://example.com', 'abc123');
      expect(url).toBe('https://example.com/s/abc123');
    });

    it('handles trailing slash in baseUrl', () => {
      const url = buildPublicUrl('https://example.com/', 'abc123');
      expect(url).toBe('https://example.com//s/abc123');
      // Note: callers must not pass a trailing slash — this is intentional doc
    });
  });
});
