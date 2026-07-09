/**
 * GET /api/testimonials/my-video?userId=<id>
 * Returns the member's result-video upload/verification status.
 */
import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { getMyVideoTestimonial } from '../../../features/testimonials/testimonials.service.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (req.method !== 'GET') return methodNotAllowed(res);
  return runService(res, () => getMyVideoTestimonial(req.query));
}
