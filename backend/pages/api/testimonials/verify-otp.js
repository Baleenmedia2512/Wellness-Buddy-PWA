/**
 * POST /api/testimonials/verify-otp
 * Coach enters the OTP received by email to mark a testimonial as verified.
 */
import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { verifyOtp } from '../../../features/testimonials/testimonials.service.js';
import logger from '../../../shared/lib/logger.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (req.method !== 'POST') return methodNotAllowed(res);

  logger.info('[testimonials/verify-otp] incoming request', {
    testimonialId: req.body?.testimonialId ?? 'unknown',
  });

  return runService(res, () => verifyOtp(req.body));
}
