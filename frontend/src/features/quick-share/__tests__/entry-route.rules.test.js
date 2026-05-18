/**
 * frontend/src/features/quick-share/__tests__/entry-route.rules.test.js
 */
import {
  shouldShowCamera,
  isEligibleRole,
  resolveAppStateFromEvent,
} from '../domain/entry-route.rules';

describe('isEligibleRole', () => {
  it.each([
    ['member', true],
    ['user',   true],
    ['MEMBER', true],
    ['coach',  false],
    ['admin',  false],
    ['',       false],
    [null,     false],
  ])('role %s → %s', (role, expected) => {
    expect(isEligibleRole(role)).toBe(expected);
  });
});

describe('shouldShowCamera', () => {
  it('returns true for eligible member on cold-start with flag ON', () => {
    expect(shouldShowCamera({ cameraFirstEnabled: true, userRole: 'member', appState: 'cold-start' }))
      .toBe(true);
  });

  it('returns true on resume-from-lock', () => {
    expect(shouldShowCamera({ cameraFirstEnabled: true, userRole: 'member', appState: 'resume-from-lock' }))
      .toBe(true);
  });

  it('returns false when flag is OFF', () => {
    expect(shouldShowCamera({ cameraFirstEnabled: false, userRole: 'member', appState: 'cold-start' }))
      .toBe(false);
  });

  it('returns false for coach role', () => {
    expect(shouldShowCamera({ cameraFirstEnabled: true, userRole: 'coach', appState: 'cold-start' }))
      .toBe(false);
  });

  it('returns false for in-app navigation', () => {
    expect(shouldShowCamera({ cameraFirstEnabled: true, userRole: 'member', appState: 'in-app' }))
      .toBe(false);
  });

  it('returns false for unknown appState', () => {
    expect(shouldShowCamera({ cameraFirstEnabled: true, userRole: 'member', appState: 'unknown' }))
      .toBe(false);
  });
});

describe('resolveAppStateFromEvent', () => {
  it('returns background when isActive=false', () => {
    expect(resolveAppStateFromEvent({ isActive: false, wasInBackground: false, backgroundedForMs: 0 }))
      .toBe('background');
  });

  it('returns resume-from-lock when backgrounded > threshold', () => {
    expect(resolveAppStateFromEvent({ isActive: true, wasInBackground: true, backgroundedForMs: 5000 }))
      .toBe('resume-from-lock');
  });

  it('returns in-app for short background gaps (< 2 s)', () => {
    expect(resolveAppStateFromEvent({ isActive: true, wasInBackground: true, backgroundedForMs: 500 }))
      .toBe('in-app');
  });

  it('returns in-app when wasInBackground=false', () => {
    expect(resolveAppStateFromEvent({ isActive: true, wasInBackground: false, backgroundedForMs: 0 }))
      .toBe('in-app');
  });
});
