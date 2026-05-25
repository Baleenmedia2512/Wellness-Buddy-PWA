/**
 * Unit tests for nativeLifecycle service.
 *
 * Coverage target: ≥ 90% lines / 80% branches (claude.md §9.1 shared/).
 *
 * KEY REGRESSION GUARD — camera auto-open ordering
 * ─────────────────────────────────────────────────────────────────────────────
 * BUG: On login, App.js fired the camera auto-open 1200ms after `user` was
 * set, racing with the permission-dialog chain (camera → push → geolocation).
 * The camera opened while permission dialogs were still visible, which was
 * jarring and blocked the location prompt.
 *
 * FIX: App.js now awaits requestAllPermissions() and sets `permissionsReady`
 * only after all dialogs resolve. The camera effect guards on
 * `permissionsReady && isUserActive` before starting its timer.
 *
 * These tests verify that requestAllPermissions() ALWAYS returns a resolving
 * Promise (both on web and native-mocked paths), so the `.then()` in App.js
 * is guaranteed to fire and unlock the camera.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { requestAllPermissions, isNative, scheduleSplashHide } from '../index.js';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: jest.fn(() => false) },
}));

jest.mock('@capacitor/app', () => ({
  App: { addListener: jest.fn(() => Promise.resolve({ remove: jest.fn() })) },
}));

jest.mock('@capacitor/camera', () => ({
  Camera: { requestPermissions: jest.fn().mockResolvedValue({ camera: 'granted', photos: 'granted' }) },
}));

jest.mock('@capacitor/push-notifications', () => ({
  PushNotifications: { requestPermissions: jest.fn().mockResolvedValue({ receive: 'granted' }) },
}));

jest.mock('@capacitor/geolocation', () => ({
  Geolocation: { requestPermissions: jest.fn().mockResolvedValue({ location: 'granted' }) },
}));

jest.mock('@capacitor/splash-screen', () => ({
  SplashScreen: { hide: jest.fn().mockResolvedValue(undefined) },
}));

const { Capacitor } = require('@capacitor/core');
const { Camera } = require('@capacitor/camera');
const { PushNotifications } = require('@capacitor/push-notifications');
const { Geolocation } = require('@capacitor/geolocation');

afterEach(() => {
  jest.clearAllMocks();
  Capacitor.isNativePlatform.mockReturnValue(false);
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('requestAllPermissions', () => {
  it('resolves on web without requesting any native permissions', async () => {
    Capacitor.isNativePlatform.mockReturnValue(false);
    await expect(requestAllPermissions()).resolves.toBeUndefined();
    expect(Camera.requestPermissions).not.toHaveBeenCalled();
    expect(PushNotifications.requestPermissions).not.toHaveBeenCalled();
    expect(Geolocation.requestPermissions).not.toHaveBeenCalled();
  });

  it('resolves on native after requesting camera, push and geolocation in order', async () => {
    Capacitor.isNativePlatform.mockReturnValue(true);
    const order = [];
    Camera.requestPermissions.mockImplementation(async () => { order.push('camera'); });
    PushNotifications.requestPermissions.mockImplementation(async () => { order.push('push'); });
    Geolocation.requestPermissions.mockImplementation(async () => { order.push('location'); });

    await expect(requestAllPermissions()).resolves.toBeUndefined();
    expect(order).toEqual(['camera', 'push', 'location']);
  });

  it('regression: still resolves when a permission dialog throws — permissionsReady must always fire', async () => {
    // If this rejects, the .then() in App.js never fires → permissionsReady stays
    // false → camera never auto-opens → silent regression. The catch in App.js
    // is belt-and-suspenders; this test guards the primary path.
    Capacitor.isNativePlatform.mockReturnValue(true);
    Camera.requestPermissions.mockRejectedValue(new Error('Permission plugin unavailable'));

    // requestAllPermissions swallows errors internally — must not throw
    await expect(requestAllPermissions()).resolves.toBeUndefined();
  });
});

describe('isNative', () => {
  it('returns false on web', () => {
    Capacitor.isNativePlatform.mockReturnValue(false);
    expect(isNative()).toBe(false);
  });

  it('returns true on native', () => {
    Capacitor.isNativePlatform.mockReturnValue(true);
    expect(isNative()).toBe(true);
  });
});

describe('scheduleSplashHide', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // clearAllMocks strips mockResolvedValue; restore it so SplashScreen.hide()
    // returns a Promise and the internal .catch() chain doesn't throw.
    const { SplashScreen } = require('@capacitor/splash-screen');
    SplashScreen.hide.mockResolvedValue(undefined);
  });
  afterEach(() => jest.useRealTimers());

  it('returns a no-op cleanup on web', () => {
    Capacitor.isNativePlatform.mockReturnValue(false);
    const cleanup = scheduleSplashHide(500);
    expect(typeof cleanup).toBe('function');
    expect(() => cleanup()).not.toThrow();
  });

  it('calls SplashScreen.hide after the specified delay on native', async () => {
    Capacitor.isNativePlatform.mockReturnValue(true);
    const { SplashScreen } = require('@capacitor/splash-screen');
    scheduleSplashHide(500);
    jest.advanceTimersByTime(499);
    expect(SplashScreen.hide).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(SplashScreen.hide).toHaveBeenCalledTimes(1);
  });

  it('cleanup cancels the timer', () => {
    Capacitor.isNativePlatform.mockReturnValue(true);
    const { SplashScreen } = require('@capacitor/splash-screen');
    const cleanup = scheduleSplashHide(500);
    cleanup();
    jest.advanceTimersByTime(1000);
    expect(SplashScreen.hide).not.toHaveBeenCalled();
  });
});
