/**
 * POST /api/testimonials/prepare-video-upload
 * Returns signed Supabase Storage URLs so the client can upload videos directly,
 * avoiding Vercel's serverless request-body size limit (~4.5 MB).
 */
import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { prepareVideoUpload } from '../../../features/testimonials/testimonials.service.js';
import logger from '../../../shared/lib/logger.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (req.method !== 'POST') return methodNotAllowed(res);

  logger.info('[testimonials/prepare-video-upload] incoming request', {
    userId: req.body?.userId ?? 'unknown',
  });

  return runService(res, () => prepareVideoUpload(req.body));
}
