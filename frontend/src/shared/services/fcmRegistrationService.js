import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { debugLog } from '../utils/logger';

// Module-level guard: listeners are registered once and remain for the app's
// lifetime (Capacitor plugin listeners survive React re-renders and user
// switches). The callback ref is updated on every initializeFCM() call so
// each user session targets the correct account.
let initialized = false;
let tokenCallbackRef = null;

export async function initializeFCM(onTokenReceived) {
  if (!Capacitor.isNativePlatform()) return;

  // Always update the callback BEFORE the guard check.
  // This handles user-switch: when a new user logs in, the new callback
  // replaces the previous user's callback so any subsequent token event
  // (e.g. token refresh triggered by PushNotifications.register()) saves
  // to the correct account instead of the signed-out user's row.
  tokenCallbackRef = onTokenReceived;

  if (initialized) return;
  initialized = true;

  PushNotifications.addListener('registration', async (token) => {
    debugLog('🔥 FCM Token Generated', token.value);

    try {
      if (tokenCallbackRef) {
        await tokenCallbackRef(token.value);
      }
    } catch (err) {
      debugLog('❌ Failed to save FCM token', err);
    }
  });

  PushNotifications.addListener('registrationError', (error) => {
    debugLog('❌ FCM Registration Error', error);
  });

  PushNotifications.addListener(
    'pushNotificationReceived',
    (notification) => {
      debugLog('📩 Push notification received', notification);
    }
  );
}

/**
 * Clear the active session's FCM callback.
 *
 * Call on sign-out so that if the OS fires a token-refresh event between
 * logout and the next user's login, the stale callback cannot write the
 * new token to the signed-out user's row.
 *
 * Does NOT reset `initialized` — Capacitor plugin listeners remain in
 * place. The next initializeFCM() call will update tokenCallbackRef
 * before the guard runs, ensuring the new user's callback is used.
 */
export function resetFCM() {
  tokenCallbackRef = null;
}
