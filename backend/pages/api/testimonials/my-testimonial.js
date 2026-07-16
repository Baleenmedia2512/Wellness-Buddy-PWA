/**
 * GET /api/testimonials/my-testimonial?userId=<id>
 * Returns the authenticated member's own testimonial (with 30-min signed image URLs).
 */
import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { getMyTestimonial } from '../../../features/testimonials/testimonials.service.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (req.method !== 'GET') return methodNotAllowed(res);
  return runService(res, () => getMyTestimonial(req.query));
}
