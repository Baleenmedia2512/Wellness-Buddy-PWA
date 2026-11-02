import { parseStoredImage } from '../images/dataUri.js';

/**
 * Send a 302 to a signed/public file URL.
 *
 * Public CDN URLs (no SigV4 query) are stable → longer browser cache of the
 * redirect is safe. Presigned URLs expire (~1h) → keep a short redirect TTL.
 *
 * @returns {boolean} true if redirected
 */
export function sendImageRedirect(res, r2Url) {
  if (!r2Url) return false;
  const signed = /[?&]X-Amz-Signature=/i.test(r2Url);
  res.setHeader(
    'Cache-Control',
    signed ? 'private, max-age=300' : 'private, max-age=3600',
  );
  res.redirect(302, r2Url);
  return true;
}

/**
 * Prefer the stored file. When that file is missing, send the database
 * photo so the diary does not fall back to the plate / cap / scale icon.
 *
 * @returns {boolean} true if a response was sent
 */
export function sendStoredImage(res, { r2Url = null, image = null } = {}) {
  if (sendImageRedirect(res, r2Url)) return true;
  const stored = parseStoredImage(image);
  if (!stored) return false;
  res.setHeader('Content-Type', stored.contentType);
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.status(200).send(stored.bytes);
  return true;
}
