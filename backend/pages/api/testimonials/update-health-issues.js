/**
 * POST /api/testimonials/update-health-issues
 * Disabled: coaches cannot edit downline health issues on Transformation.
 * Always returns 403; members edit via Mine submit/edit flows instead.
 */
import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { updateMemberHealthIssues } from '../../../features/testimonials/testimonials.service.js';
import logger from '../../../shared/lib/logger.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (req.method !== 'POST') return methodNotAllowed(res);

  logger.info('[testimonials/update-health-issues] incoming request', {
    coachId: req.body?.coachId ?? 'unknown',
    userId: req.body?.userId ?? 'unknown',
  });

  return runService(res, () => updateMemberHealthIssues(req.body));
}
