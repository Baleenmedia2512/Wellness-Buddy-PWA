/**
 * GET /api/testimonials/list-for-coach?coachId=<id>
 * Returns all direct downline members with their testimonial status.
 * Members without a testimonial have testimonial=null (rendered red in UI).
 */
import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { listForCoach } from '../../../features/testimonials/testimonials.service.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (req.method !== 'GET') return methodNotAllowed(res);
  return runService(res, () => listForCoach(req.query));
}
