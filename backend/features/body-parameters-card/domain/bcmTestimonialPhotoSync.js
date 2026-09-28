/**
 * Previously mirrored BCM/Profile Left → testimonial Before.
 * Disabled — Profile photos and Transformation Before/After stay separate.
 */
export async function syncBcmPhotosToTestimonial() {
  return { skipped: true, reason: 'profile_transformation_sync_disabled' };
}
