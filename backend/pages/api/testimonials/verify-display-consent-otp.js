/**
 * POST /api/testimonials/verify-display-consent-otp
 * Member: verify email OTP → set website_display_consent_at.
 */
import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { verifyWebsiteDisplayConsentOtp } from '../../../features/testimonials/websiteDisplayConsent.service.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (req.method !== 'POST') return methodNotAllowed(res);
  return runService(res, () => verifyWebsiteDisplayConsentOtp(req.body));
}
