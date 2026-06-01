/**
 * Unit tests for shared/lib/storage.js
 * Coverage target: ≥ 90% lines / 80% branches (claude.md §9.1 shared/).
 */
import storage from '../storage';

beforeEach(() => {
  window.localStorage.clear();
  jest.restoreAllMocks();
});

describe('storage.get', () => {
  it('returns null when key does not exist', () => {
    expect(storage.get('missing')).toBeNull();
  });

  it('returns the stored string value', () => {
    window.localStorage.setItem('auth.lastEmail', 'demo@gmail.com');
    expect(storage.get('auth.lastEmail')).toBe('demo@gmail.com');
  });

  it('returns null when localStorage.getItem throws', () => {
    jest.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(storage.get('auth.lastEmail')).toBeNull();
  });
});

describe('storage.set', () => {
  it('persists a string value', () => {
    storage.set('auth.lastEmail', 'user@example.com');
    expect(window.localStorage.getItem('auth.lastEmail')).toBe('user@example.com');
  });

  it('ignores empty string values', () => {
    storage.set('auth.lastEmail', '');
    expect(window.localStorage.getItem('auth.lastEmail')).toBeNull();
  });

  it('ignores non-string values', () => {
    storage.set('auth.lastEmail', null);
    storage.set('auth.lastEmail', 123);
    expect(window.localStorage.getItem('auth.lastEmail')).toBeNull();
  });

  it('degrades silently when localStorage.setItem throws (quota exceeded)', () => {
    jest.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });
    expect(() => storage.set('auth.lastEmail', 'a@b.com')).not.toThrow();
  });
});

describe('storage.remove', () => {
  it('removes an existing key', () => {
    window.localStorage.setItem('auth.lastEmail', 'x@y.com');
    storage.remove('auth.lastEmail');
    expect(window.localStorage.getItem('auth.lastEmail')).toBeNull();
  });

  it('does not throw when key does not exist', () => {
    expect(() => storage.remove('nonexistent')).not.toThrow();
  });
});
