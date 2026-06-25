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
 * Request all required permissions in order: camera → push → geolocation.
 * Returns { locationGranted: boolean } so callers can gate app access.
 * On web always returns { locationGranted: true } (no-op).
 */
export async function requestAllPermissions() {
  if (!Capacitor.isNativePlatform()) return { locationGranted: true };
  try {
    debugLog("📱 Requesting all permissions at once...");

    // Request camera/gallery permissions
    await Camera.requestPermissions({ permissions: ["camera", "photos"] });

    // Request push notification permissions
    const pushPermission = await PushNotifications.requestPermissions();

    if (pushPermission.receive === 'granted') {
      await PushNotifications.register();
      debugLog('Push notification registration requested');
    }
    // Request location permissions for attendance tracking
    await Geolocation.requestPermissions();

    // FEATURE DISABLED — Reminders (Android exact-alarm) commented out, see App.js history
    // FEATURE DISABLED — Step Counter (ACTIVITY_RECOGNITION) commented out, see App.js history

    debugLog("✅ All permissions requested");
  } catch (err) {
    console.warn("❌ Permission request failed:", err);
  }
}
