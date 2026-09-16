/**
 * Sync Profile Left/Right slots (+ optional weight) onto testimonials Before/After.
 * Uses sync-profile-photos API — no OTP; direct Transformation submit owns approval.
 */
import { syncProfilePhotosToTestimonial } from '../../testimonials/services/testimonialApi';

function isDataImage(value) {
  return typeof value === 'string' && /^data:image\/[a-zA-Z0-9+.-]+;base64,/.test(value.trim());
}

export async function persistOnboardingTestimonialPhotos({
  userId,
  weightKg,
  leftImageBase64,
  rightImageBase64,
  goalType,
  recoveredHealthIssues,
}) {
  const uid = Number.parseInt(String(userId), 10);
  if (!Number.isFinite(uid) || uid < 1) return;

  const weight = Number.isFinite(weightKg) ? weightKg : null;
  const left = isDataImage(leftImageBase64) ? leftImageBase64.trim() : null;
  const right = isDataImage(rightImageBase64) ? rightImageBase64.trim() : null;
  if (weight == null && !left && !right) return;

  const goal = goalType === 'gain' || goalType === 'loss' ? goalType : 'loss';

  try {
    await syncProfilePhotosToTestimonial({
      userId: uid,
      ...(left ? { beforeImageBase64: left } : {}),
      ...(right ? { afterImageBase64: right } : {}),
      ...(weight != null ? { beforeWeightKg: weight } : {}),
      goalType: goal,
      recoveredHealthIssues: recoveredHealthIssues || [],
    });
  } catch (err) {
    const msg = String(err?.message || err || '');
    if (/no coach assigned/i.test(msg)) return;
    throw err;
  }
}
