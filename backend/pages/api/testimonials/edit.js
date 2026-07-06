/**
 * POST /api/testimonials/edit
 * Member edits their existing testimonial.
 * Always resets status to pending and re-sends the verification email to coach.
 */
import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { editTestimonial } from '../../../features/testimonials/testimonials.service.js';
import logger from '../../../shared/lib/logger.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (req.method !== 'POST') return methodNotAllowed(res);

  logger.info('[testimonials/edit] incoming request', {
    userId: req.body?.userId ?? 'unknown',
  });

  return runService(res, () => editTestimonial(req.body));
}
