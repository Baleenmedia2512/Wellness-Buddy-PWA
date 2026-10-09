/**
 * POST /api/testimonials/cancel-unified-otp
 * Member cancels/closes the pending approval OTP flow and reverts pending changes.
 */
import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { cancelUnifiedOtp } from '../../../features/testimonials/testimonials.service.js';
import logger from '../../../shared/lib/logger.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (req.method !== 'POST') return methodNotAllowed(res);

  logger.info('[testimonials/cancel-unified-otp] incoming request', {
    userId: req.body?.userId ?? 'unknown',
  });

  return runService(res, () => cancelUnifiedOtp(req.body));
}
