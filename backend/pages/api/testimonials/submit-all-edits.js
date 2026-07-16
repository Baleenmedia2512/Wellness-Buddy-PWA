/**
 * POST /api/testimonials/submit-all-edits
 * Member submits multiple edited slots (photos, videos, health issues) in one request.
 * Generates a single unified OTP and emails the coach with a diff of what changed.
 */
import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { submitAllEdits } from '../../../features/testimonials/testimonials.service.js';
import logger from '../../../shared/lib/logger.js';

export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (req.method !== 'POST') return methodNotAllowed(res);

  logger.info('[testimonials/submit-all-edits] incoming request', {
    userId:     req.body?.userId     ?? 'unknown',
    dirtySlots: req.body?.dirtySlots ?? [],
  });

  return runService(res, () => submitAllEdits(req.body));
}
