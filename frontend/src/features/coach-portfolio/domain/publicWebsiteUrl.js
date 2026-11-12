import { getApiBaseUrl } from '../../../config/api.config.js';

/**
 * Public coach pages are served by the backend (API host), not the CRA/Vite port.
 * Relative `/coach/...` links must open on API_BASE_URL (e.g. :3000), not the app (:3001).
 *
 * @param {string|null|undefined} pathOrUrl
 * @returns {string|null}
 */
export function publicWebsiteUrl(pathOrUrl) {
  const raw = String(pathOrUrl || '').trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  const path = raw.startsWith('/') ? raw : `/${raw}`;
  try {
    return `${getApiBaseUrl()}${path}`;
  } catch {
    return path;
  }
}
