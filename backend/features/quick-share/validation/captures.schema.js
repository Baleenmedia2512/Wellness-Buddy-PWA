/**
 * captures.schema.js — input validation for quick-share capture endpoints.
 */

/**
 * Validate the POST /api/quick-share/captures request.
 * Returns { ok: true } or { ok: false, error: string }.
 *
 * @param {{ imageBase64: unknown, mimeType: unknown, userId: unknown }} body
 * @returns {{ ok: boolean, error?: string }}
 */
export function validateCreateCapture(body) {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Request body is required.' };
  }

  const { imageBase64, mimeType, userId } = body;

  if (!imageBase64 || typeof imageBase64 !== 'string') {
    return { ok: false, error: 'imageBase64 is required and must be a string.' };
  }
  if (imageBase64.length > 8 * 1024 * 1024) {
    // 8 MB base64 ≈ 6 MB binary — reject oversized payloads
    return { ok: false, error: 'Image exceeds 8 MB limit.' };
  }

  const ALLOWED_MIME = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!mimeType || !ALLOWED_MIME.includes(String(mimeType))) {
    return { ok: false, error: `mimeType must be one of: ${ALLOWED_MIME.join(', ')}.` };
  }

  if (!userId) {
    return { ok: false, error: 'userId is required.' };
  }

  return { ok: true };
}

/**
 * Validate the GET /api/quick-share/public/[token] request.
 * @param {unknown} token
 * @returns {{ ok: boolean, error?: string }}
 */
export function validatePublicToken(token) {
  if (!token || typeof token !== 'string' || !/^[A-Za-z0-9]{6,20}$/.test(token)) {
    return { ok: false, error: 'Invalid share token.' };
  }
  return { ok: true };
}
