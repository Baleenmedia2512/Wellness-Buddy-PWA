/**
 * Shared API fetch — attaches X-App-Version so the backend can gate
 * version-aware feature flags via isEnabledForAppVersion.
 *
 * Prefer this over raw fetch() for backend calls that may eventually
 * use version-gated behaviour.
 */
import { getApiBaseUrl } from '../../config/api.config.js';
import APP_VERSION from '../../config/version.js';

export const APP_VERSION_HEADER = 'X-App-Version';

/**
 * @returns {Record<string, string>}
 */
export function getAppVersionHeaders() {
  return {
    [APP_VERSION_HEADER]: String(APP_VERSION.VERSION || ''),
  };
}

/**
 * @param {string} pathOrUrl - Absolute URL or path relative to API base
 * @param {RequestInit & { apiBaseUrl?: string }} [options]
 * @returns {Promise<Response>}
 */
export async function apiFetch(pathOrUrl, options = {}) {
  const { apiBaseUrl, headers, ...rest } = options;
  const base = (apiBaseUrl || getApiBaseUrl()).replace(/\/+$/, '');
  const url = /^https?:\/\//i.test(pathOrUrl)
    ? pathOrUrl
    : `${base}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;

  const mergedHeaders = {
    ...getAppVersionHeaders(),
    ...(headers || {}),
  };

  return fetch(url, {
    ...rest,
    headers: mergedHeaders,
  });
}
