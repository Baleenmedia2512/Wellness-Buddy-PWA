/**
 * Previously synced Profile Left → Transformation Before.
 * Disabled — Profile Left/Centre/Right and Transformation Before/After stay separate.
 * Kept as a no-op so older call sites do not break.
 */
export async function persistOnboardingTestimonialPhotos() {
  return { skipped: true, reason: 'profile_transformation_sync_disabled' };
}
