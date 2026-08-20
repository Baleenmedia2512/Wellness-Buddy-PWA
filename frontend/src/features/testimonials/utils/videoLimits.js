/**
 * Upload caps for result videos.
 */
export const MAX_HEALTH_VIDEO_MB = 15;
export const MAX_BUSINESS_VIDEO_MB = 15;
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
  return `Upload max of ${maxMb} MB.`;
}
