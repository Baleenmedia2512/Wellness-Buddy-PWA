/**
 * POST /api/testimonials/submit
 * Member submits a new before/after testimonial.
 * Triggers a verification email to their coach with a 6-digit OTP.
 */
import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { submitTestimonial } from '../../../features/testimonials/testimonials.service.js';
import logger from '../../../shared/lib/logger.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (req.method !== 'POST') return methodNotAllowed(res);

  logger.info('[testimonials/submit] incoming request', {
    userId: req.body?.userId ?? 'unknown',
  });

  return runService(res, () => submitTestimonial(req.body));
}
