/**
 * POST /api/testimonials/upload-video-chunk
 * Accepts one base64 chunk of a testimonial video and assembles on the last chunk.
 * Keeps each request under Vercel's serverless body limit (~4.5 MB).
 */
import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { uploadVideoChunk } from '../../../features/testimonials/testimonials.service.js';
import logger from '../../../shared/lib/logger.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4mb',
    },
  },
};

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (req.method !== 'POST') return methodNotAllowed(res);

  logger.info('[testimonials/upload-video-chunk] incoming request', {
    userId: req.body?.userId ?? 'unknown',
    chunkIndex: req.body?.chunkIndex ?? 'unknown',
  });

  return runService(res, () => uploadVideoChunk(req.body));
}
