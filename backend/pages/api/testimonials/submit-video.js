/**
 * POST /api/testimonials/submit-video
 * Member finalises health/business result videos after direct storage upload.
 * Photo testimonial is optional — videos can be uploaded on their own.
 * Sends a verification OTP to the coach via email.
 */
import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { submitVideo } from '../../../features/testimonials/testimonials.service.js';
import logger from '../../../shared/lib/logger.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (req.method !== 'POST') return methodNotAllowed(res);

  logger.info('[testimonials/submit-video] incoming request', {
    userId: req.body?.userId ?? 'unknown',
  });

  return runService(res, () => submitVideo(req.body));
}
