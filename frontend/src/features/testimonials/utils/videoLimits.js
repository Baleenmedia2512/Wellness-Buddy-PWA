/**
 * Upload caps for result videos. Keep files small so Share Video
 * does not wait on a ~50–100 MB download before the share sheet opens.
 */
export const MAX_HEALTH_VIDEO_MB = 10;
export const MAX_BUSINESS_VIDEO_MB = 10;
export const MAX_HEALTH_DURATION_S = 60;
export const MAX_BUSINESS_DURATION_S = 120;

export function maxVideoMbForSlot(slot) {
  return slot === 'health' ? MAX_HEALTH_VIDEO_MB : MAX_BUSINESS_VIDEO_MB;
}

export function isVideoOverSizeLimit(file, slot) {
  if (!file || typeof file.size !== 'number') return false;
  return file.size / (1024 * 1024) > maxVideoMbForSlot(slot);
}

export function videoTooLargeMessage(slot) {
  const maxMb = maxVideoMbForSlot(slot);
  const label = slot === 'health' ? 'Health' : 'Business';
  return `${label} video is too large (max ${maxMb} MB). Please compress or trim the video.`;
}
