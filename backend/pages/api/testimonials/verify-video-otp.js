/**
 * POST /api/testimonials/verify-video-otp
 * Coach (or member on behalf of coach) verifies the video testimonial using the emailed OTP.
 */
import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { verifyVideoOtp } from '../../../features/testimonials/testimonials.service.js';
import logger from '../../../shared/lib/logger.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (req.method !== 'POST') return methodNotAllowed(res);

  logger.info('[testimonials/verify-video-otp] incoming request', {
    testimonialId: req.body?.testimonialId ?? 'unknown',
  });

  return runService(res, () => verifyVideoOtp(req.body));
}
