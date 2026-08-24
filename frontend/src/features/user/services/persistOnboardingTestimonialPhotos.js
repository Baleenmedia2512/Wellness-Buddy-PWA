/**
 * Save first-run Left photos onto testimonials_table via existing APIs.
 */
import { submitTestimonial, editTestimonial, getMyTestimonial } from '../../testimonials/services/testimonialApi';

const FALLBACK_DURATION = '1 days';

export async function persistOnboardingTestimonialPhotos({
  userId,
  photos,
  weightKg,
  goalType,
  recoveredHealthIssues,
}) {
  const uid = Number.parseInt(String(userId), 10);
  if (!Number.isFinite(uid) || uid < 1) return;
  const before = photos?.beforeImageBase64;
  const after = photos?.afterImageBase64;
  if (!before && !after) return;

  const weight = Number.isFinite(weightKg) ? weightKg : null;
  if (weight == null) return;

  let existing = null;
  try {
    existing = await getMyTestimonial(uid);
  } catch {
    existing = null;
  }

  const durationText = existing?.durationText || FALLBACK_DURATION;
  const goal = goalType === 'gain' || goalType === 'loss'
    ? goalType
    : (existing?.goalType || 'loss');

  try {
    if (!existing?.beforeImageUrl && before) {
      const payload = {
        userId: uid,
        beforeImageBase64: before,
        beforeWeightKg: existing?.beforeWeightKg ?? weight,
        goalType: goal,
        durationText,
        recoveredHealthIssues: recoveredHealthIssues || [],
      };
      if (after) {
        payload.afterImageBase64 = after;
        payload.afterWeightKg = weight;
      }
      await submitTestimonial(payload);
      return;
    }

    if (after) {
      await editTestimonial({
        userId: uid,
        afterImageBase64: after,
        afterWeightKg: weight,
        recoveredHealthIssues: recoveredHealthIssues || existing?.recoveredHealthIssues,
      });
    }
  } catch (err) {
    const msg = String(err?.message || err || '');
    if (/no coach assigned/i.test(msg)) return;
    throw err;
  }
}
