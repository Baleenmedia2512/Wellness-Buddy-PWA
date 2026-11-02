/**
 * Shared API fetch — attaches X-App-Version so the backend can gate
 * version-aware feature flags and APP_VERSION_ENFORCE_API.
 *
 * Prefer this over raw fetch() for backend calls that may eventually
 * use version-gated behaviour.
 */
import { getApiBaseUrl } from '../../config/api.config.js';
import APP_VERSION from '../../config/version.js';
import { handlePossibleAppUpdateRequired } from './appVersionEnforce.client.js';

export const APP_VERSION_HEADER = 'X-App-Version';
export const APP_VERSION_CODE_HEADER = 'X-App-Version-Code';

/**
 * @returns {Record<string, string>}
 */
export function getAppVersionHeaders() {
  return {
    [APP_VERSION_HEADER]: String(APP_VERSION.VERSION || ''),
    [APP_VERSION_CODE_HEADER]: String(APP_VERSION.VERSION_CODE ?? ''),
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

  const res = await fetch(url, {
    ...rest,
    headers: mergedHeaders,
  });

  // Peek 426 bodies without consuming the stream for callers that need .json().
  if (res.status === 426) {
    try {
      const clone = res.clone();
      const body = await clone.json().catch(() => ({}));
      handlePossibleAppUpdateRequired(res, body);
    } catch {
      handlePossibleAppUpdateRequired(res, {});
    }
  }

  return res;
}
