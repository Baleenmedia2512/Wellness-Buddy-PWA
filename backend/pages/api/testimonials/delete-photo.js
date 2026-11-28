/**
 * POST /api/testimonials/delete-photo
 * Member deletes their transformation collage photo, weights, and duration.
 */
import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { deleteTransformationPhoto } from '../../../features/testimonials/testimonials.service.js';
import logger from '../../../shared/lib/logger.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (req.method !== 'POST') return methodNotAllowed(res);

  logger.info('[testimonials/delete-photo] incoming request', {
    userId: req.body?.userId ?? 'unknown',
  });

  return runService(res, () => deleteTransformationPhoto(req.body));
}
