/**
 * Send a 302 to a signed/public R2 URL. Never stream Base64.
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
