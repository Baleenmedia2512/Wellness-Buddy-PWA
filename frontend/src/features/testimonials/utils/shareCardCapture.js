/**
 * Helpers for exporting the transformation share card without a tainted canvas.
 * Full Team photos are often already painted from a no-cors image load.
 */

export function isInlineCaptureSrc(src) {
  return !src || src.startsWith('data:') || src.startsWith('blob:');
}

export function isCanvasTaintError(err) {
  const name = String(err?.name || '');
  const msg = String(err?.message || err || '');
  return name === 'SecurityError' || /tainted canvases may not be exported/i.test(msg);
}

/**
 * Extra query so a CORS read does not reuse a no-cors cached bitmap.
 * Signed Supabase URLs keep their token; the extra param is ignored.
 * @param {string} src
 * @returns {string}
 */
export function corsReloadUrl(src) {
  if (isInlineCaptureSrc(src)) return src;
  const sep = src.includes('?') ? '&' : '?';
  return `${src}${sep}wvcap=1`;
}
