/**
 * resolveShareDisplayName.test.js
 * Unit tests for the display-name resolution priority in share text / cards.
 *
 * Bug fixed: share text was showing the email prefix (e.g. "yasheeer.yash03")
 * instead of the user's app profile username (e.g. "yasheer J") because
 * savedUserName was never consulted.
 *
 * See: frontend/src/shared/utils/shareUtils.js → resolveShareDisplayName
 */

import { resolveShareDisplayName } from '../shareUtils.js';

describe('resolveShareDisplayName', () => {
  // ── Priority 1: savedUserName ──────────────────────────────────────────────
  it('returns savedUserName when all fields are present (highest priority)', () => {
    const user = { displayName: 'Firebase Name', name: 'Model Name', email: 'foo@example.com' };
    expect(resolveShareDisplayName('yasheer J', user)).toBe('yasheer J');
  });

  it('trims savedUserName whitespace', () => {
    expect(resolveShareDisplayName('  yasheer J  ', null)).toBe('yasheer J');
  });

  // ── Priority 2: user.displayName ──────────────────────────────────────────
  it('falls back to user.displayName when savedUserName is null', () => {
    const user = { displayName: 'Firebase Display', email: 'foo@example.com' };
    expect(resolveShareDisplayName(null, user)).toBe('Firebase Display');
  });

  it('falls back to user.displayName when savedUserName is empty string', () => {
    const user = { displayName: 'Firebase Display', email: 'foo@example.com' };
    expect(resolveShareDisplayName('', user)).toBe('Firebase Display');
  });

  // ── Priority 3: user.name ──────────────────────────────────────────────────
  it('falls back to user.name when savedUserName and displayName are absent', () => {
    const user = { name: 'Model Name', email: 'foo@example.com' };
    expect(resolveShareDisplayName(null, user)).toBe('Model Name');
  });

  // ── Priority 4: email prefix — BUG regression guard ───────────────────────
  it('uses email prefix ONLY when savedUserName, displayName, and name are all absent', () => {
    // This is the regression: email prefix must NOT appear when savedUserName exists.
    const user = { email: 'yasheeer.yash03@gmail.com' };
    expect(resolveShareDisplayName(null, user)).toBe('yasheeer.yash03');
  });

  it('REGRESSION: savedUserName beats email prefix — was the root cause of the bug', () => {
    const user = { email: 'yasheeer.yash03@gmail.com' };
    // Before the fix, this returned 'yasheeer.yash03'. After fix: 'yasheer J'.
    expect(resolveShareDisplayName('yasheer J', user)).toBe('yasheer J');
  });

  // ── Priority 5: fallback string ───────────────────────────────────────────
  it('returns the default fallback when everything is absent', () => {
    expect(resolveShareDisplayName(null, null)).toBe('Wellness Valley');
  });

  it('returns a custom fallback string when provided', () => {
    expect(resolveShareDisplayName(null, null, 'You')).toBe('You');
  });

  // ── Edge cases ────────────────────────────────────────────────────────────
  it('handles user with no email gracefully', () => {
    const user = { displayName: 'No Email User' };
    expect(resolveShareDisplayName(null, user)).toBe('No Email User');
  });

  it('handles user object being undefined', () => {
    expect(resolveShareDisplayName(null, undefined)).toBe('Wellness Valley');
  });

  it('handles savedUserName being whitespace-only (treated as absent)', () => {
    const user = { email: 'foo@example.com' };
    expect(resolveShareDisplayName('   ', user)).toBe('foo');
  });
});
