/**
 * Frontend unit tests for nav page access helpers.
 */
import {
  canAccessNavPage,
  resolveNavTargetOrFallback,
  allowedNavPageKeys,
  normalizeNavAccessMatrix,
  NAV_PAGE_KEYS,
} from '../domain/navAccess.rules';

describe('canAccessNavPage', () => {
  it('fails open when pages is null', () => {
    expect(canAccessNavPage(null, 'counselling')).toBe(true);
    expect(canAccessNavPage(undefined, 'home')).toBe(true);
  });

  it('respects page map when loaded', () => {
    const pages = { home: true, counselling: false };
    expect(canAccessNavPage(pages, 'home')).toBe(true);
    expect(canAccessNavPage(pages, 'counselling')).toBe(false);
  });

  it('denies unknown keys', () => {
    expect(canAccessNavPage(null, 'profile')).toBe(false);
  });
});

describe('resolveNavTargetOrFallback', () => {
  it('returns null when allowed', () => {
    expect(resolveNavTargetOrFallback('home', { home: true })).toBeNull();
  });

  it('falls back to home when denied and home allowed', () => {
    expect(resolveNavTargetOrFallback('counselling', {
      home: true,
      counselling: false,
    })).toBe('home');
  });

  it('falls back to first allowed when home denied', () => {
    expect(resolveNavTargetOrFallback('counselling', {
      home: false,
      dashboard: true,
      counselling: false,
    })).toBe('dashboard');
  });
});

describe('allowedNavPageKeys', () => {
  it('returns all keys when pages null', () => {
    expect(allowedNavPageKeys(null)).toEqual([...NAV_PAGE_KEYS]);
  });
});

describe('normalizeNavAccessMatrix', () => {
  it('fills all roles and page keys as booleans', () => {
    const m = normalizeNavAccessMatrix({ user: { home: 1 } });
    expect(m.user.home).toBe(true);
    expect(m.user.dashboard).toBe(false);
    expect(m.coach.home).toBe(false);
    expect(m.admin).toBeDefined();
    expect(m.developer).toBeDefined();
  });
});
