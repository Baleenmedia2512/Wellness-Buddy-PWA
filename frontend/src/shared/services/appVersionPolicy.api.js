/**
 * App version policy — client API + session dismiss helpers.
 */
import { getApiBaseUrl } from '../../config/api.config.js';
import { Capacitor } from '@capacitor/core';
import APP_VERSION from '../../config/version.js';

const DISMISS_PREFIX = 'appVersionDismissedRecommended:';

export function getClientPlatform() {
  try {
    if (!Capacitor.isNativePlatform()) return 'web';
    return Capacitor.getPlatform() === 'ios' ? 'ios' : 'android';
  } catch {
    return 'web';
  }
}

export function getClientVersionPayload() {
  return {
    version: APP_VERSION.VERSION,
    versionCode: APP_VERSION.VERSION_CODE,
    platform: getClientPlatform(),
  };
}

export function isSoftUpdateDismissed(recommendedVersion) {
  if (typeof window === 'undefined' || !recommendedVersion) return false;
  try {
    return window.localStorage.getItem(`${DISMISS_PREFIX}${recommendedVersion}`) === 'true';
  } catch {
    return false;
  }
}

export function dismissSoftUpdate(recommendedVersion) {
  if (typeof window === 'undefined' || !recommendedVersion) return;
  try {
    window.localStorage.setItem(`${DISMISS_PREFIX}${recommendedVersion}`, 'true');
  } catch {
    /* ignore */
  }
}

/**
 * Fetch version policy with a simple GET (version in query only).
 * Do NOT send X-App-Version here — that header triggers CORS preflight;
 * if Allow-Headers omits it, Android WebView blocks the GET and the app
 * fail-opens to Home (exactly the bug we saw in Vercel OPTIONS-only logs).
 *
 * @returns {Promise<{ ok: boolean, data?: object, networkError?: boolean }>}
 */
export async function fetchAppVersionPolicy() {
  const { version, versionCode, platform } = getClientVersionPayload();
  const params = new URLSearchParams({
    version,
    platform,
    versionCode: String(versionCode),
  });

  try {
    const base = getApiBaseUrl().replace(/\/+$/, '');
    const res = await fetch(`${base}/api/app/version-policy?${params.toString()}`, {
      method: 'GET',
      // Accept is CORS-safelisted — no preflight required for this GET.
      headers: { Accept: 'application/json' },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      return { ok: false, networkError: true };
    }
    return { ok: true, data: data.data || {} };
  } catch {
    return { ok: false, networkError: true };
  }
}
