/**
 * Opens the OS Settings page for this app.
 * iOS: native AppSettingsPlugin (UIApplication.openSettingsURLString).
 *      Must be listed in capacitor.config packageClassList or it never loads.
 * Android: GalleryMonitorPlugin ACTION_APPLICATION_DETAILS_SETTINGS.
 */
import { Capacitor, registerPlugin } from '@capacitor/core';

const AppSettings = registerPlugin('AppSettings');

export async function openNativeAppSettings() {
  if (!Capacitor.isNativePlatform()) return false;

  const platform = Capacitor.getPlatform();
  try {
    if (platform === 'ios') {
      await AppSettings.open();
      return true;
    }
    if (platform === 'android') {
      const { GalleryMonitorPlugin } = await import('./galleryMonitorPlugin.js');
      await GalleryMonitorPlugin.openAppSettings();
      return true;
    }
  } catch (err) {
    console.warn('[AppSettings] openNativeAppSettings failed:', err);
    // Last-resort iOS fallback (may be ignored by newer iOS; native plugin is preferred).
    if (platform === 'ios') {
      try {
        window.location.href = 'app-settings:';
        return true;
      } catch (fallbackErr) {
        console.warn('[AppSettings] app-settings: fallback failed:', fallbackErr);
      }
    }
  }
  return false;
}
