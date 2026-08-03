/**
 * GET /api/testimonials/video-report?coachId=&scope=
 * Returns the video upload/verification status for all team members.
 * Used by the coach to see who has/hasn't uploaded videos and who needs verification.
 */
import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { getVideoReport } from '../../../features/testimonials/testimonials.service.js';
import logger from '../../../shared/lib/logger.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (req.method !== 'GET') return methodNotAllowed(res);

  logger.info('[testimonials/video-report] incoming request', {
    coachId: req.query?.coachId ?? 'unknown',
    scope:   req.query?.scope   ?? 'direct',
  });

  return runService(res, () => getVideoReport(req.query));
}
