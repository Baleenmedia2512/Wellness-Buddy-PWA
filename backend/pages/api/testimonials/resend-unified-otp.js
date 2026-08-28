/**
 * POST /api/testimonials/resend-unified-otp
 * Member requests a new OTP after the previous unified OTP expired.
 * Regenerates the code and emails the sponsor again.
 */
import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { resendUnifiedOtp } from '../../../features/testimonials/testimonials.service.js';
import logger from '../../../shared/lib/logger.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (req.method !== 'POST') return methodNotAllowed(res);

  logger.info('[testimonials/resend-unified-otp] incoming request', {
    userId: req.body?.userId ?? 'unknown',
  });

  return runService(res, () => resendUnifiedOtp(req.body));
}
