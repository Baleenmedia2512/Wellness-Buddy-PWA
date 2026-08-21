/**
 * permissionManager.js — Centralised Permission Manager
 *
 * Single source of truth for all runtime permission logic in Wellness Valley.
 * Replaces scattered per-feature permission handling for Camera, Location, and
 * Notifications.
 *
 * Permission State Model (Capacitor / OS):
 * ─────────────────────────────────────────────────────────────────────────────
 * 'prompt'   → OS will show a system dialog. Occurs when:
 *              • The permission has never been requested (Android + iOS).
 *              • Android: permission was denied ONCE and the user did NOT select
 *                "Don't ask again" (shouldShowRequestPermissionRationale = true).
 *              Action: show in-app explanation dialog → request → handle result.
 *
 * 'granted'  → Permission is active. No dialog needed.
 *
 * 'denied'   → The OS will NOT show a system dialog. Occurs when:
 *              • Android: "Don't ask again" was selected, OR the permission was
 *                denied twice in a row (API 29+ auto-blocks after 2nd denial).
 *              • iOS: ANY denial is permanent (iOS has no "ask again" path).
 *              Action: direct user to App Settings — the only OS-allowed path.
 *
 * 'limited'  → iOS only: partial Photos access. Treated as 'granted' here since
 *              the app can still read/write captured images.
 *
 * 'unknown'  → Plugin error or unsupported platform. Fail-open.
 *
 * Why canRequest?
 * ───────────────
 * `canRequest: true`  → `status === 'prompt'` — safe to call requestPermission().
 * `canRequest: false` → `status === 'denied'` — OS will silently reject the
 *                       request. Only Settings can unblock it.
 *
 * This binary flag lets UI components branch without knowing Capacitor internals.
 */

import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { Camera } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';
import { PushNotifications } from '@capacitor/push-notifications';

// ── Permission type constants ─────────────────────────────────────────────────

/** @typedef {'camera'|'location'|'notifications'|'contacts'} PermissionType */

/**
 * Static configuration for each permission.
 * icon     : emoji for modals / pages.
 * label    : human-readable short name.
 * reason   : one-sentence use-case (inline prompt copy).
 * required : true = blocks app access; false = silently skipped on denial.
 */
export const PERMISSION_CONFIG = {
  camera: {
    label: 'Camera',
    icon: '📷',
    reason: 'Snap your meal and get instant AI nutrition analysis.',
    required: true,
  },
  location: {
    label: 'Location',
    icon: '📍',
    reason: 'Auto-check in at your nearest wellness center and track your attendance.',
    required: true,
  },
  notifications: {
    label: 'Notifications',
    icon: '🔔',
    reason: "We'll remind you to log meals, water, and your daily weight on time.",
    required: false,
  },
  contacts: {
    label: 'Contacts',
    icon: '👤',
    reason: 'Save new Body Parameters members to your phone contacts when you create a card.',
    required: false,
  },
};

// ── Core API ─────────────────────────────────────────────────────────────────

/**
 * Check the current OS-level status of a permission without prompting the user.
 *
 * @param {PermissionType} type
 * @returns {Promise<{ status: 'granted'|'denied'|'prompt'|'unknown', canRequest: boolean, granted: boolean }>}
 */
export async function checkPermission(type) {
  if (!Capacitor.isNativePlatform()) {
    return { status: 'granted', canRequest: false, granted: true };
  }

  try {
    let rawStatus;

    if (type === 'camera') {
      const result = await Camera.checkPermissions();
      rawStatus = result?.camera;
      // iOS 'limited' = partial Photos access; treat as granted for our purposes.
      if (rawStatus === 'limited') rawStatus = 'granted';
    } else if (type === 'location') {
      const result = await Geolocation.checkPermissions();
      rawStatus = result?.location;
    } else if (type === 'notifications') {
      const result = await PushNotifications.checkPermissions();
      rawStatus = result?.receive;
    } else if (type === 'contacts') {
      const { Contacts } = await import('@capacitor-community/contacts');
      const result = await Contacts.checkPermissions();
      rawStatus = result?.contacts;
      // iOS 18+ "Limited Access" — native plugin still allows createContact.
      if (rawStatus === 'limited') rawStatus = 'granted';
    }

    const status = rawStatus ?? 'unknown';
    const granted = status === 'granted';
    // Only 'prompt' allows the OS to show a system dialog.
    const canRequest = status === 'prompt';

    return { status, canRequest, granted };
  } catch (err) {
    console.warn(`[PermissionManager] checkPermission(${type}) failed:`, err);
    return { status: 'unknown', canRequest: false, granted: false };
  }
}

/**
 * Invoke the OS permission request dialog for a single permission type.
 * Only call this when checkPermission() returned canRequest: true.
 *
 * After the OS dialog closes (granted or denied), this resolves with the new
 * status. The caller should call checkPermission() again if it needs to
 * distinguish 'prompt' (re-requestable) from 'denied' (permanent).
 *
 * @param {PermissionType} type
 * @returns {Promise<{ status: 'granted'|'denied'|'prompt'|'unknown', granted: boolean }>}
 */
export async function requestPermission(type) {
  if (!Capacitor.isNativePlatform()) {
    return { status: 'granted', granted: true };
  }

  try {
    if (type === 'camera') {
      const result = await Camera.requestPermissions({ permissions: ['camera', 'photos'] });
      let status = result?.camera;
      if (status === 'limited') status = 'granted';
      return { status: status ?? 'unknown', granted: status === 'granted' };
    }

    if (type === 'location') {
      const result = await Geolocation.requestPermissions();
      // Geolocation can grant either fine (location) or coarse (coarseLocation).
      const fineLoc = result?.location;
      const coarseLoc = result?.coarseLocation;
      const granted = fineLoc === 'granted' || coarseLoc === 'granted';
      const status = fineLoc ?? coarseLoc ?? 'unknown';
      return { status, granted };
    }

    if (type === 'notifications') {
      const result = await PushNotifications.requestPermissions();
      const status = result?.receive ?? 'unknown';
      const granted = status === 'granted';
      if (granted) {
        // Register the push token after permission is granted.
        await PushNotifications.register().catch((e) =>
          console.warn('[PermissionManager] Push register failed (non-fatal):', e),
        );
      }
      return { status, granted };
    }

    if (type === 'contacts') {
      const { Contacts } = await import('@capacitor-community/contacts');
      const result = await Contacts.requestPermissions();
      let status = result?.contacts ?? 'unknown';
      // iOS 18+ limited access is enough for createContact.
      if (status === 'limited') status = 'granted';
      return { status, granted: status === 'granted' };
    }

    return { status: 'unknown', granted: false };
  } catch (err) {
    console.warn(`[PermissionManager] requestPermission(${type}) failed:`, err);
    return { status: 'unknown', granted: false };
  }
}

/**
 * Open this app's entry in the OS Settings app.
 *
 * Android: calls GalleryMonitorPlugin.openAppSettings() which fires
 *          ACTION_APPLICATION_DETAILS_SETTINGS — opens the app's own
 *          Permissions page directly. `app-settings:` is iOS-only and
 *          silently fails on Android.
 * iOS:     uses the `app-settings:` URL scheme via CapacitorApp.openUrl().
 * Web:     no-op.
 */
export async function openAppSettings() {
  if (!Capacitor.isNativePlatform()) return;
  const platform = Capacitor.getPlatform();
  try {
    if (platform === 'android') {
      const { GalleryMonitorPlugin } = await import('../plugins/galleryMonitorPlugin.js');
      await GalleryMonitorPlugin.openAppSettings();
    } else {
      // iOS: app-settings: opens this app's Settings entry.
      await CapacitorApp.openUrl({ url: 'app-settings:' });
    }
  } catch (err) {
    console.warn('[PermissionManager] openAppSettings failed:', err);
  }
}

// ── Sequential flow helper ────────────────────────────────────────────────────

/**
 * Walk through a list of permission types and return the first one that is not
 * yet granted, along with its current state.
 *
 * Returns null when every permission in the list is already granted.
 *
 * @param {PermissionType[]} types  Ordered list to check.
 * @returns {Promise<{ type: PermissionType, status: string, canRequest: boolean } | null>}
 */
export async function findNextPendingPermission(types) {
  for (const type of types) {
    const { status, canRequest, granted } = await checkPermission(type);
    if (!granted) {
      return { type, status, canRequest };
    }
  }
  return null;
}
