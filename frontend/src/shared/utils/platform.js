import { Capacitor } from '@capacitor/core';

/** True on Capacitor iOS — emoji often renders as ? in WKWebView. */
export function isIOS() {
  return Capacitor.getPlatform() === 'ios';
}
