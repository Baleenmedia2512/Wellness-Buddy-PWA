/**
 * POST /api/testimonials/sync-profile-photos
 * Profile / BCM Left·Right → testimonial Before·After without OTP.
 */
import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { syncProfilePhotosToTestimonial } from '../../../features/testimonials/profilePhotoSync.service.js';
import logger from '../../../shared/lib/logger.js';

export const config = { api: { bodyParser: { sizeLimit: '8mb' } } };

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (req.method !== 'POST') return methodNotAllowed(res);

  logger.info('[testimonials/sync-profile-photos] incoming request', {
    userId: req.body?.userId ?? 'unknown',
    hasBefore: Boolean(req.body?.beforeImageBase64),
    hasAfter: Boolean(req.body?.afterImageBase64),
  });

  return runService(res, () => syncProfilePhotosToTestimonial(req.body));
}
