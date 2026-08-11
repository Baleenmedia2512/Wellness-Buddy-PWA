/**
 * App version policy — client API + session dismiss helpers.
 */
import { apiFetch } from './apiFetch.js';
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
    const res = await apiFetch(`/api/app/version-policy?${params.toString()}`, {
      method: 'GET',
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
