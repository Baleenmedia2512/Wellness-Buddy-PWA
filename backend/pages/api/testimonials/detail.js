/**
 * GET /api/testimonials/detail?userId=&coachId=
 * Full before/after images, videos, and share fields for one member.
 * Call only when opening / editing / sharing — not for the team list.
 */
import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { getTestimonialDetail } from '../../../features/testimonials/testimonials.service.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (req.method !== 'GET') return methodNotAllowed(res);
  return runService(res, () => getTestimonialDetail(req.query));
}
