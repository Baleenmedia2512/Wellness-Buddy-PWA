/**
 * frontend/src/config/__tests__/featureFlags.test.js
 *
 * Unit tests for the frontend feature-flag resolver.
 *
 * Each test snapshots `localStorage` + `process.env` and restores
 * them in `afterEach` so cases cannot leak across each other.
 */
import { isFlagEnabled, getFlagSpec } from '../featureFlags';

const ENV_KEY     = 'REACT_APP_FF_DIARY_FEED';
const STORAGE_KEY = 'ff.diary-feed';

afterEach(() => {
  delete process.env[ENV_KEY];
  try { window.localStorage.removeItem(STORAGE_KEY); } catch (_) { /* ignore */ }
});

describe('feature-flag registry', () => {
  it('registers ff.diary-feed with the documented metadata', () => {
    const spec = getFlagSpec('ff.diary-feed');
    expect(spec).not.toBeNull();
    expect(spec.envKey).toBe(ENV_KEY);
    expect(spec.storageKey).toBe(STORAGE_KEY);
    expect(spec.defaultEnabled).toBe(false);
  });

  it('returns null for an unknown flag', () => {
    expect(getFlagSpec('ff.does-not-exist')).toBeNull();
  });
});

describe('isFlagEnabled', () => {
  it('returns defaultEnabled when no override is set', () => {
    expect(isFlagEnabled('ff.diary-feed')).toBe(false);
  });

  it('honours the localStorage override first', () => {
    window.localStorage.setItem(STORAGE_KEY, 'true');
    process.env[ENV_KEY] = 'false'; // would otherwise force OFF
    expect(isFlagEnabled('ff.diary-feed')).toBe(true);
  });

  it('honours the env override when no localStorage entry', () => {
    process.env[ENV_KEY] = 'true';
    expect(isFlagEnabled('ff.diary-feed')).toBe(true);
  });

  it.each(['TRUE', 'True', ' true '])('parses %p as true (case-insensitive, trim)', (v) => {
    process.env[ENV_KEY] = v;
    expect(isFlagEnabled('ff.diary-feed')).toBe(true);
  });

  it.each(['FALSE', 'False', ' false '])('parses %p as false', (v) => {
    process.env[ENV_KEY] = v;
    expect(isFlagEnabled('ff.diary-feed')).toBe(false);
  });

  it('falls back to defaultEnabled on garbage values', () => {
    process.env[ENV_KEY] = 'yes';
    expect(isFlagEnabled('ff.diary-feed')).toBe(false);
  });

  it('fails closed (returns false) for an unknown flag', () => {
    expect(isFlagEnabled('ff.does-not-exist')).toBe(false);
  });
});
