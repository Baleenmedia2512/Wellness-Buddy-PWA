/**
 * Send a 302 to a signed/public R2 URL. Never stream Base64.
 * @returns {boolean} true if redirected
 */
export function sendImageRedirect(res, r2Url) {
  if (!r2Url) return false;
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.redirect(302, r2Url);
  return true;
}
