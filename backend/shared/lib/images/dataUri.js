/**
 * Parse stored profile / meal images that may be data URIs, raw base64, or https URLs.
 */

const DATA_URI_RE = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/;

export function isHttpsImageUrl(value) {
  return typeof value === 'string' && /^https:\/\//i.test(value.trim());
}

export function isDataImageUri(value) {
  return typeof value === 'string' && DATA_URI_RE.test(value.trim());
}

/**
 * @param {unknown} value
 * @returns {{ contentType: string, bytes: Buffer } | null}
 */
export function parseDataUri(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  const match = trimmed.match(DATA_URI_RE);
  if (!match) return null;
  try {
    const bytes = Buffer.from(match[2].replace(/\s/g, ''), 'base64');
    if (!bytes.length) return null;
    return { contentType: match[1], bytes };
  } catch {
    return null;
  }
}

/** Custom uploaded avatars (data URI) should go to R2. Google https URLs stay as-is. */
export function shouldStoreProfileImageInR2(value) {
  return isDataImageUri(value);
}

/**
 * Meal photos may be a data URI or raw base64 (no prefix) in ImageBase64.
 * @param {unknown} value
 * @returns {{ contentType: string, bytes: Buffer } | null}
 */
export function parseStoredImage(value) {
  const fromUri = parseDataUri(value);
  if (fromUri) return fromUri;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || /^https?:\/\//i.test(trimmed) || trimmed.startsWith('data:')) return null;
  if (!/^[A-Za-z0-9+/=\s]+$/.test(trimmed.slice(0, 96))) return null;
  try {
    const bytes = Buffer.from(trimmed.replace(/\s/g, ''), 'base64');
    if (bytes.length < 8) return null;
    return { contentType: 'image/jpeg', bytes };
  } catch {
    return null;
  }
}

export function shouldStoreFoodImageInR2(value) {
  return parseStoredImage(value) != null;
}

export function extensionForContentType(contentType) {
  const ct = String(contentType || '').toLowerCase();
  if (ct === 'image/png') return 'png';
  if (ct === 'image/webp') return 'webp';
  if (ct === 'image/gif') return 'gif';
  return 'jpg';
}
