/**
 * Unit tests for backend/shared/lib/feature-flags.js
 *
 * Pure — no I/O. Each test snapshots the relevant env var and restores
 * it in `afterEach` so cases cannot leak across each other.
 *
 * The registry is shared module state (singleton), so we test against
 * the production-registered flag `ff.diary-feed` rather than tear it
 * down and rebuild it between cases — see ADR-0003 for why this flag
 * is registered at module-init time.
 */
import {
  isEnabled,
  getSpec,
  findStaleFlags,
} from '../lib/feature-flags.js';

afterEach(() => {
  delete process.env.FF_DIARY_FEED;
});

describe('feature-flags registry', () => {
  it('registers ff.diary-feed at module init with the documented metadata', () => {
    const spec = getSpec('ff.diary-feed');
    expect(spec).not.toBeNull();
    expect(spec.owner).toBe('@principal-eng');
    expect(spec.defaultEnabled).toBe(false);
    expect(spec.createdAt).toBe('2026-06-05');
    expect(spec.removeBy).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(spec.description).toMatch(/diary/i);
  });

  it('freezes the spec so callers cannot mutate it', () => {
    const spec = getSpec('ff.diary-feed');
    expect(Object.isFrozen(spec)).toBe(true);
  });

  it('returns null for an unregistered flag', () => {
    expect(getSpec('ff.does-not-exist')).toBeNull();
  });
});

describe('isEnabled', () => {
  it('returns defaultEnabled when no env override is set', () => {
    expect(isEnabled('ff.diary-feed')).toBe(false);
  });

  it('returns true when FF_DIARY_FEED=true', () => {
    process.env.FF_DIARY_FEED = 'true';
    expect(isEnabled('ff.diary-feed')).toBe(true);
  });

  it('returns false when FF_DIARY_FEED=false', () => {
    process.env.FF_DIARY_FEED = 'false';
    expect(isEnabled('ff.diary-feed')).toBe(false);
  });

  it('is case-insensitive (TRUE / FALSE / True / False all work)', () => {
    process.env.FF_DIARY_FEED = 'TRUE';
    expect(isEnabled('ff.diary-feed')).toBe(true);
    process.env.FF_DIARY_FEED = 'False';
    expect(isEnabled('ff.diary-feed')).toBe(false);
  });

  it('falls back to defaultEnabled on garbage env values', () => {
    process.env.FF_DIARY_FEED = '1';      // not 'true' / 'false'
    expect(isEnabled('ff.diary-feed')).toBe(false);
    process.env.FF_DIARY_FEED = 'yes';
    expect(isEnabled('ff.diary-feed')).toBe(false);
  });

  it('fails closed (returns false) for an unknown flag', () => {
    expect(isEnabled('ff.does-not-exist')).toBe(false);
  });
});

describe('findStaleFlags', () => {
  it('returns the empty list when no flag is past its removeBy date', () => {
    // ff.diary-feed.removeBy is 2026-12-05; "now" before that is fresh.
    const stale = findStaleFlags(new Date('2026-06-05T00:00:00Z'));
    expect(stale).toEqual([]);
  });

  it('lists flags whose removeBy is in the past', () => {
    const stale = findStaleFlags(new Date('2027-01-01T00:00:00Z'));
    expect(stale).toEqual([
      expect.objectContaining({
        name: 'ff.diary-feed',
        owner: '@principal-eng',
      }),
    ]);
  });
});
