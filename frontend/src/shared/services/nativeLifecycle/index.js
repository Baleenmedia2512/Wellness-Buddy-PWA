/**
 * nativeLifecycle — single authoritative boundary for Capacitor native concerns
 * that App.js used to handle inline.
 *
 * What this owns:
 *   - SplashScreen dismissal timing
 *   - StatusBar overlay configuration
 *   - `App.addListener("appStateChange", …)` registration plumbing
 *     (the *plumbing*, not the policy: each consumer still passes its own
 *     handler, and each consumer still gets back its own PluginListenerHandle
 *     so cleanup stays handler-scoped)
 *   - Permission bootstrap (camera/photos, push, geolocation)
 *
 * What this deliberately does NOT own (App.js stays the orchestrator):
 *   - When/whether to register an appStateChange listener
 *   - Auth, routing, image-pipeline, or weight-flow policy
 *   - Back-button handling (already encapsulated in shared/utils/backButtonHandler)
 *   - GalleryMonitor lifecycle (already its own service)
 *
 * Design notes:
 *   - This module is a *namespace*, not a singleton with hidden state. It does
 *     not register listeners on its own initiative. App.js continues to be the
 *     only place that decides when listeners come and go.
 *   - All entry points are no-ops on web. Native-only paths import their
 *     plugins lazily where appropriate to keep the web bundle slim.
 *   - Behavior, timing, and error-swallowing semantics are preserved exactly
 *     as they were in App.js prior to extraction (May 2026 hygiene phase).
 */

import { App as CapacitorApp } from "@capacitor/app";
import { Camera } from "@capacitor/camera";
import { Geolocation } from "@capacitor/geolocation";
import { PushNotifications } from "@capacitor/push-notifications";
import { SplashScreen } from "@capacitor/splash-screen";
import { Capacitor } from "@capacitor/core";
import { debugLog } from '../../utils/logger.js';

/**
 * Returns true on iOS/Android (Capacitor native), false on web.
 * Thin wrapper kept here so callers can import lifecycle-related checks
 * from one place.
 */
export function isNative() {
  return Capacitor.isNativePlatform();
}

/**
 * Schedule SplashScreen.hide() to fire `delayMs` after the current tick.
 *
 * Returns a cleanup function that cancels the timer. Safe to call from a
 * `useEffect` (matches the pre-extraction shape exactly):
 *
 *   useEffect(() => scheduleSplashHide(500), []);
 *
 * - On web: no-op, returns a no-op cleanup.
 * - Errors from SplashScreen.hide() are swallowed (the native layer may have
 *   already hidden the splash; that is expected, not an error).
 *
 * Timing: 500ms default — preserved from the original App.js implementation.
 */
export function scheduleSplashHide(delayMs = 500) {
  if (!Capacitor.isNativePlatform()) return () => {};
  const timer = setTimeout(() => {
    SplashScreen.hide().catch(() => {
      /* already hidden by native layer — expected, no-op */
    });
  }, delayMs);
  return () => clearTimeout(timer);
}

/**
 * Configure the native StatusBar to sit above the WebView (not overlay it).
 * Lazily imports `@capacitor/status-bar` so the plugin is not pulled into the
 * web bundle. Errors (including plugin-not-available) are logged via
 * `console.warn` exactly like the original inline implementation.
 *
 * Returns a Promise that always resolves; callers do not need to await it.
 */
export function initStatusBar() {
  if (!Capacitor.isNativePlatform()) return Promise.resolve();
  return import("@capacitor/status-bar")
    .then(({ StatusBar }) => {
      StatusBar.setOverlaysWebView({ overlay: false });
    })
    .catch((err) => {
      console.warn("StatusBar plugin not available:", err);
    });
}

/**
 * Register an `appStateChange` listener with Capacitor's App plugin.
 *
 * IMPORTANT — preserved semantics:
 *   - Each call returns its own PluginListenerHandle. Multiple listeners on
 *     the same event are supported by Capacitor and are used by App.js
 *     intentionally (gallery effect + foreground profile-check effect).
 *   - The caller is responsible for storing the handle and calling
 *     `handle.remove()` on cleanup. This service NEVER calls
 *     `App.removeAllListeners()` (which would also wipe sibling listeners).
 *   - On web, returns a stub handle whose `remove()` is a no-op so callers
 *     can use one cleanup path on every platform.
 *
 * @param {(state: { isActive: boolean }) => void} handler
 * @returns {Promise<{ remove: () => Promise<void> | void }>}
 */
export function addAppStateListener(handler) {
  if (!Capacitor.isNativePlatform()) {
    return Promise.resolve({ remove: () => {} });
  }
  // App.addListener returns Promise<PluginListenerHandle> in modern Capacitor.
  return Promise.resolve(CapacitorApp.addListener("appStateChange", handler));
}

/**
 * Register a handler for native deep-link / App Link events (Capacitor's
 * `appUrlOpen`). Fired when the OS launches the app to handle a URL — both
 * Android App Links (https://<host>/share/...) and custom-scheme
 * (wellnessvalley://share/...) flow through here.
 *
 * Same contract as addAppStateListener: returns a handle whose `remove()`
 * the caller MUST invoke on cleanup. No-op on web.
 *
 * @param {(event: { url: string }) => void} handler
 * @returns {Promise<{ remove: () => Promise<void> | void }>}
 */
export function addAppUrlOpenListener(handler) {
  if (!Capacitor.isNativePlatform()) {
    return Promise.resolve({ remove: () => {} });
  }
  return Promise.resolve(CapacitorApp.addListener("appUrlOpen", handler));
}

/**
 * Returns the URL that launched the app this session, if any. Useful for
 * cold-start deep links where `appUrlOpen` may have already fired before
 * the React tree mounted its listener.
 *
 * Resolves to `null` on web or when there is no launch URL.
 *
 * @returns {Promise<string | null>}
 */
export async function getLaunchUrl() {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const result = await CapacitorApp.getLaunchUrl();
    return result?.url || null;
  } catch {
    return null;
  }
}

/**
 * Bootstrap permissions for the authenticated-user flow.
 *
 * Preserved from App.js verbatim:
 *   - Order: camera/photos → push → geolocation.
 *   - Each request is awaited sequentially (matches prior behavior so any
 *     OS-level prompt chaining stays identical).
 *   - Failure of one prompt is reported via console.warn but does NOT throw.
 *   - No-op on web.
 *
 * The Android exact-alarm and step-counter bootstrap blocks remain commented
 * out here for parity with App.js — both were disabled in the original
 * implementation. Kept as breadcrumbs for the future Reminders / StepCounter
 * re-enablement, not as live code.
 */
/**
 * Request all required permissions sequentially.
 *
 * Each permission step has its own try/catch so one failure can NEVER skip
 * the remaining steps (the original single-try-catch was the primary reason
 * Location was never requested during onboarding).
 *
 * Order follows the required UX spec:
 *   1. Camera + Photos  (REQUIRED)
 *   2. Location         (REQUIRED — must be granted before home access)
 *   3. Notifications    (OPTIONAL — failure never blocks the flow)
 *
 * Returns { cameraGranted, locationGranted } so callers can enforce mandatory
 * permission gates. On web always returns fully-granted (no-op).
 *
 * @returns {Promise<{ cameraGranted: boolean, locationGranted: boolean }>}
 */
export async function requestAllPermissions() {
  if (!Capacitor.isNativePlatform()) {
    return { cameraGranted: true, locationGranted: true };
  }

  debugLog('📱 Requesting permissions sequentially…');

  // ── Step 1: Camera + Photos (REQUIRED) ───────────────────────────────────
  // Isolated try/catch: failure here must never prevent Location from being requested.
  let cameraGranted = false;
  try {
    const result = await Camera.requestPermissions({ permissions: ['camera', 'photos'] });
    cameraGranted = result?.camera === 'granted';
    debugLog('📷 Camera:', result?.camera, '| Photos:', result?.photos);
  } catch (err) {
    console.warn('❌ Camera/Photos permission request failed:', err);
  }

  // ── Step 2: Location (REQUIRED — MANDATORY) ───────────────────────────────
  // Isolated try/catch: failure here must never prevent Notifications being requested.
  let locationGranted = false;
  try {
    const result = await Geolocation.requestPermissions();
    locationGranted =
      result?.location === 'granted' || result?.coarseLocation === 'granted';
    debugLog('📍 Location:', result?.location, '| Coarse:', result?.coarseLocation);
  } catch (err) {
    console.warn('❌ Location permission request failed:', err);
  }

  // ── Step 3: Notifications (OPTIONAL — never blocks the flow) ─────────────
  try {
    const push = await PushNotifications.requestPermissions();
    if (push?.receive === 'granted') {
      await PushNotifications.register().catch((e) =>
        console.warn('Push register failed (non-fatal):', e),
      );
    }
    debugLog('🔔 Notifications:', push?.receive);
  } catch (err) {
    // Notifications are optional — log but never throw.
    console.warn('⚠️ Notification permission request failed (non-fatal):', err);
  }

  // FEATURE DISABLED — Reminders (Android exact-alarm) commented out, see App.js history
  // FEATURE DISABLED — Step Counter (ACTIVITY_RECOGNITION) commented out, see App.js history

  debugLog('✅ Permission requests complete:', { cameraGranted, locationGranted });
  return { cameraGranted, locationGranted };
}

/**
 * Check whether Location Services (GPS) are currently enabled on the device.
 *
 * - Android: delegates to the native GalleryMonitorPlugin.isLocationEnabled()
 *   for an instant synchronous check (no timeout, no GPS warm-up required).
 * - iOS + Android fallback: attempts getCurrentPosition with a 5 s timeout and
 *   a zero maximumAge so a stale cached fix cannot mask a disabled service.
 *   POSITION_UNAVAILABLE (code 2) means Location Services are off.
 * - Web: always returns true (no-op).
 *
 * @returns {Promise<boolean>}
 */
export async function checkGpsEnabled() {
  if (!Capacitor.isNativePlatform()) return true;

  const platform = Capacitor.getPlatform();

  if (platform === 'android') {
    try {
      const { GalleryMonitorPlugin } = await import('../../plugins/galleryMonitorPlugin.js');
      const result = await GalleryMonitorPlugin.isLocationEnabled();
      return result?.enabled === true;
    } catch (err) {
      debugLog('Native GPS check failed, falling back to getCurrentPosition:', err?.message);
      // Fall through to getCurrentPosition fallback below.
    }
  }

  // iOS or Android fallback: getCurrentPosition fails fast when Location
  // Services are off (code 2 = POSITION_UNAVAILABLE).
  try {
    await Geolocation.getCurrentPosition({
      timeout: 5000,
      enableHighAccuracy: false,
      maximumAge: 0, // No cache — we need to know the service is live right now.
    });
    return true;
  } catch (err) {
    if (err?.code === 2) return false; // POSITION_UNAVAILABLE → Location Services off.
    return true; // TIMEOUT (code 3) or PERMISSION_DENIED (code 1) — don't block on these.
  }
}

/**
 * Open the device Location Settings screen so the user can enable GPS.
 *
 * - Android: opens ACTION_LOCATION_SOURCE_SETTINGS (the Location on/off toggle)
 *   via the native GalleryMonitorPlugin.
 * - iOS: opens this app's own Settings pane. iOS restricts deep-linking to the
 *   system Privacy → Location Services screen since iOS 15.
 * - Web: no-op.
 */
export async function openLocationSettings() {
  if (!Capacitor.isNativePlatform()) return;
  const platform = Capacitor.getPlatform();
  try {
    if (platform === 'android') {
      const { GalleryMonitorPlugin } = await import('../../plugins/galleryMonitorPlugin.js');
      await GalleryMonitorPlugin.openLocationSettings();
    } else {
      // iOS: opens this app's specific Settings pane where the user can adjust
      // the Location permission. There is no public API to open the system
      // Location Services toggle directly on iOS 15+.
      await CapacitorApp.openUrl({ url: 'app-settings:' });
    }
  } catch (err) {
    console.warn('Failed to open Location Settings:', err);
  }
}

/**
 * Check the current status of the location permission without prompting the user.
 *
 * @returns {Promise<'granted'|'denied'|'prompt'|'unknown'>}
 */
export async function checkLocationPermission() {
  if (!Capacitor.isNativePlatform()) return 'granted';
  try {
    const result = await Geolocation.checkPermissions();
    const status = result?.location;
    if (status === 'granted') return 'granted';
    if (status === 'denied') return 'denied';
    return 'prompt';
  } catch (err) {
    console.warn('Failed to check location permission:', err);
    return 'unknown';
  }
}
