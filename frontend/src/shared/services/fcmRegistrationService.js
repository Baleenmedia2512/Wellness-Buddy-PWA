import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { debugLog } from '../utils/logger';

let initialized = false;

export async function initializeFCM(onTokenReceived) {
  if (!Capacitor.isNativePlatform()) return;
  if (initialized) return;

  initialized = true;

  PushNotifications.addListener('registration', async (token) => {
    debugLog('🔥 FCM Token Generated', token.value);

    try {
      await onTokenReceived(token.value);
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