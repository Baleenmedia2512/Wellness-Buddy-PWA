/**
 * POST /api/testimonials/request-display-consent-otp
 * Member: email OTP to self after agreeing to show Transformation on all upline websites.
 */
import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { requestWebsiteDisplayConsentOtp } from '../../../features/testimonials/websiteDisplayConsent.service.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (req.method !== 'POST') return methodNotAllowed(res);
  return runService(res, () => requestWebsiteDisplayConsentOtp(req.body));
}
