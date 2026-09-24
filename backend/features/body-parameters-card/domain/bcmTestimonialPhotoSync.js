/**
 * After BCM profile sync, mirror optional Left photo to testimonial Before
 * **for new users only** (no existing Transformation Before).
 * After is not updated from Profile Right — Transformation After is set later.
 * Non-fatal — BCM card + profile save already succeeded.
 */
import { syncProfilePhotosToTestimonial } from '../../testimonials/profilePhotoSync.service.js';
import { deriveWeightGoalMode } from '../../../utils/weightValidation.js';
import logger from '../../../shared/lib/logger.js';

/**
 * @param {{
 *   userId: number|null|undefined,
 *   transformationPhotos?: { left?: string|null, front?: string|null, right?: string|null }|null,
 *   weightKg?: number|null,
 *   heightCm?: number|null,
 *   recoveredHealthIssues?: string[],
 * }} params
 */
export async function syncBcmPhotosToTestimonial({
  userId,
  transformationPhotos,
  weightKg,
  heightCm,
  recoveredHealthIssues,
}) {
  const uid = Number.parseInt(String(userId), 10);
  if (!Number.isFinite(uid) || uid < 1) return;
  if (!transformationPhotos || typeof transformationPhotos !== 'object') return;

  const left = transformationPhotos.left || null;
  if (!left) return;

  const weight = weightKg != null && Number.isFinite(Number(weightKg)) && Number(weightKg) > 0
    ? Number(weightKg)
    : undefined;

  try {
    await syncProfilePhotosToTestimonial({
      userId: uid,
      beforeImageBase64: left || undefined,
      beforeWeightKg: weight,
      goalType: deriveWeightGoalMode({ heightCm, currentWeightKg: weight }) || 'loss',
      recoveredHealthIssues: Array.isArray(recoveredHealthIssues) ? recoveredHealthIssues : undefined,
    });
  } catch (err) {
    logger.warn('[bcmTestimonialPhotoSync] testimonial sync failed (non-fatal)', {
      userId: uid,
      message: err?.message,
    });
  }
}
