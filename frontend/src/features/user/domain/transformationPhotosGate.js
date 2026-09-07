/**
 * Transformation photos onboarding gate — Left / Centre / Right.
 * New users hit this after Complete Profile; existing users with a complete
 * profile but missing slots are prompted on the next login so we do not miss data.
 *
 * 'show' — profile loaded and at least one slot is empty.
 * 'hide' — already saved this session, or all three slots are filled.
 * 'keep' — fetch failed; do not change the current screen.
 */
import { allTransformationSlotsFilled } from './transformationPoseGuide.js';

export function hasCompleteTransformationPhotos(photos) {
  return allTransformationSlotsFilled(photos || {});
}

export function resolveTransformationPhotosGate({
  confirmedThisSession = false,
  profile = null,
  fetchFailed = false,
} = {}) {
  if (confirmedThisSession) return 'hide';
  if (fetchFailed) return 'keep';
  if (!profile) return 'hide';
  if (!hasCompleteTransformationPhotos(profile.transformationPhotos)) return 'show';
  return 'hide';
}
