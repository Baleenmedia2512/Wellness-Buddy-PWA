/**
 * Cache-bust signed testimonial media URLs so Android WebView shows fresh images
 * after replacement (same storage key pattern can otherwise reuse a cached bitmap).
 *
 * Also rewrite /api/testimonials/file links onto REACT_APP_API_BASE_URL so a
 * mis-set TESTIMONIAL_FILE_BASE_URL (e.g. live host while using test) does not
 * 404 Before/After photos.
 */
import { getApiBaseUrl } from '../../../config/api.config.js';

/**
 * Point testimonial file URLs at the configured API host.
 * @param {string|null|undefined} url
 * @param {string} [apiBase]
 * @returns {string|null|undefined}
 */
export function resolveTestimonialMediaUrl(url, apiBase) {
  if (!url || typeof url !== 'string') return url;
  if (url.startsWith('blob:') || url.startsWith('data:')) return url;

  let base = '';
  try {
    base = String(apiBase || getApiBaseUrl() || '').replace(/\/+$/, '');
  } catch {
    base = String(apiBase || '').replace(/\/+$/, '');
  }
  if (!base) return url;

  try {
    if (url.startsWith('/api/testimonials/file')) {
      return `${base}${url}`;
    }
    const parsed = new URL(url);
    if (parsed.pathname.includes('/api/testimonials/file')) {
      return `${base}${parsed.pathname}${parsed.search}`;
    }
  } catch {
    return url;
  }
  return url;
}

/**
 * @param {string|null|undefined} url
 * @param {string|number|null|undefined} version — typically testimonial.updatedAt
 * @returns {string|null|undefined}
 */
export function withTestimonialMediaCacheBust(url, version) {
  const resolved = resolveTestimonialMediaUrl(url);
  if (!resolved || typeof resolved !== 'string') return resolved;
  if (resolved.startsWith('blob:') || resolved.startsWith('data:')) return resolved;
  if (version == null || version === '') return resolved;
  const sep = resolved.includes('?') ? '&' : '?';
  return `${resolved}${sep}t=${encodeURIComponent(String(version))}`;
}

/**
 * Parse CapacitorHttp response bodies — native Android often returns JSON strings.
 * @param {unknown} data
 * @returns {object|null}
 */
export function parseCapacitorHttpJson(data) {
  if (data == null) return null;
  if (typeof data === 'object') return data;
  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Convert a JPEG data URL into a blob: object URL.
 * Android WebView often fails to paint large data: URLs in <img>, but blob: URLs work.
 *
 * @param {string} dataUrl
 * @returns {string}
 */
export function jpegDataUrlToObjectUrl(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) return dataUrl;
  if (typeof atob !== 'function' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    return dataUrl;
  }
  const comma = dataUrl.indexOf(',');
  if (comma < 0) return dataUrl;
  const binary = atob(dataUrl.slice(comma + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: 'image/jpeg' }));
}

/**
 * Revoke a blob: URL if the runtime supports it.
 * @param {string|null|undefined} url
 */
export function revokeBlobUrl(url) {
  if (!url || typeof url !== 'string' || !url.startsWith('blob:')) return;
  if (typeof URL === 'undefined' || typeof URL.revokeObjectURL !== 'function') return;
  URL.revokeObjectURL(url);
}
