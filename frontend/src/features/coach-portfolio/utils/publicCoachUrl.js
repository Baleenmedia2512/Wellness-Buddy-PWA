/**
 * Public coach pages live on the API/site host (/coach/...), not the Capacitor
 * WebView origin. Relative hrefs white-screen on Android/iOS.
 */
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { getApiBaseUrl } from '../../../config/api.config.js';

/**
 * @param {string|null|undefined} publicPath e.g. /coach/city/area/name
 * @returns {string|null}
 */
export function resolvePublicCoachUrl(publicPath) {
  if (!publicPath || typeof publicPath !== 'string') return null;
  const path = publicPath.trim();
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const base = String(getApiBaseUrl() || '').replace(/\/$/, '');
  if (!base) return path.startsWith('/') ? path : `/${path}`;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * Open the live coach page in the system browser on native (avoids WebView
 * white screen). Web uses a normal new tab.
 * @param {string|null|undefined} publicPath
 * @param {Event} [event]
 */
export async function openPublicCoachUrl(publicPath, event) {
  if (event?.preventDefault) event.preventDefault();
  const url = resolvePublicCoachUrl(publicPath);
  if (!url) return;
  if (Capacitor.isNativePlatform()) {
    try {
      await App.openUrl({ url });
      return;
    } catch {
      // Fall through to window.open
    }
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}
