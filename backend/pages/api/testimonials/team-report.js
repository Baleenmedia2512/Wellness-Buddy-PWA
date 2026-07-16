/**
 * GET /api/testimonials/team-report?coachId=
 * Returns upload / not-upload counts and percentages for photo and video
 * reports across direct and full team scopes.
 */
import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { getTeamTestimonialReport } from '../../../features/testimonials/testimonials.service.js';
import logger from '../../../shared/lib/logger.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (req.method !== 'GET') return methodNotAllowed(res);

  logger.info('[testimonials/team-report] incoming request', {
    coachId: req.query?.coachId ?? 'unknown',
  });

  return runService(res, () => getTeamTestimonialReport(req.query));
}
