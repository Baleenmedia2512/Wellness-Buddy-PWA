import { resolveStoreUrl, isLinkPreviewBot } from '../../utils/shareLandingRedirect.js';

/**
 * /api/share — device-aware redirect endpoint for Wellness Valley app installations.
 * Redirects:
 *   - iOS devices → Apple App Store
 *   - Android devices → Google Play Store
 *   - Desktop / Fallback → Google Play Store
 */
export default function handler(req, res) {
  const ua = req.headers['user-agent'] || '';
  const destination = resolveStoreUrl(ua);
  return res.redirect(302, destination);
}

