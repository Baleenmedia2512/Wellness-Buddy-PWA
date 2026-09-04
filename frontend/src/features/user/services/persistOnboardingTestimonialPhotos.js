/**
 * Copy Complete Profile current weight onto testimonials Before
 * when that field is still empty.
 */
import { submitTestimonial, editTestimonial, getMyTestimonial } from '../../testimonials/services/testimonialApi';

const FALLBACK_DURATION = '1 days';

function hasWeight(value) {
  const n = value != null ? parseFloat(value) : NaN;
  return Number.isFinite(n) && n > 0;
}

function isDataImage(value) {
  return typeof value === 'string' && /^data:image\/[a-zA-Z0-9+.-]+;base64,/.test(value.trim());
}

function hasBeforePhoto(existing) {
  const url = existing?.beforeImageUrl;
  return typeof url === 'string' && url.trim().length > 0;
}

export async function persistOnboardingTestimonialPhotos({
  userId,
  weightKg,
  leftImageBase64,
  goalType,
  recoveredHealthIssues,
}) {
  const uid = Number.parseInt(String(userId), 10);
  if (!Number.isFinite(uid) || uid < 1) return;
  const weight = Number.isFinite(weightKg) ? weightKg : null;
  const left = isDataImage(leftImageBase64) ? leftImageBase64.trim() : null;
  if (weight == null && !left) return;

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
    if (!existing) {
      if (!left || weight == null) return;
      await submitTestimonial({
        userId: uid,
        beforeImageBase64: left,
        beforeWeightKg: weight,
        goalType: goal,
        durationText,
        recoveredHealthIssues: recoveredHealthIssues || [],
      });
      return;
    }

    const patch = { userId: uid };
    if (left && !hasBeforePhoto(existing)) {
      patch.beforeImageBase64 = left;
    }
    if (weight != null && !hasWeight(existing.beforeWeightKg)) {
      patch.beforeWeightKg = weight;
    }
    const incomplete = !existing.status || existing.status === 'incomplete';
    const realAfter = !incomplete
      && existing.afterImageUrl
      && existing.afterImageUrl !== existing.beforeImageUrl;
    if (weight != null && !realAfter && !hasWeight(existing.afterWeightKg)) {
      patch.afterWeightKg = weight;
    }
    if (patch.beforeImageBase64 == null
      && patch.beforeWeightKg == null
      && patch.afterWeightKg == null) return;
    await editTestimonial(patch);
  } catch (err) {
    const msg = String(err?.message || err || '');
    if (/no coach assigned/i.test(msg)) return;
    throw err;
  }
}
