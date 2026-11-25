/**
 * POST /api/testimonials/revoke-display-consent
 * Member: remove Transformation from all upline websites (no OTP).
 */
import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { revokeWebsiteDisplayConsent } from '../../../features/testimonials/websiteDisplayConsent.service.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (req.method !== 'POST') return methodNotAllowed(res);
  return runService(res, () => revokeWebsiteDisplayConsent(req.body));
}
