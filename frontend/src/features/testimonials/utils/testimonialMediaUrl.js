/**
 * Cache-bust signed testimonial media URLs so Android WebView shows fresh images
 * after replacement (same storage key pattern can otherwise reuse a cached bitmap).
 *
 * @param {string|null|undefined} url
 * @param {string|number|null|undefined} version — typically testimonial.updatedAt
 * @returns {string|null|undefined}
 */
export function withTestimonialMediaCacheBust(url, version) {
  if (!url || typeof url !== 'string') return url;
  if (url.startsWith('blob:') || url.startsWith('data:')) return url;
  if (version == null || version === '') return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}t=${encodeURIComponent(String(version))}`;
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
