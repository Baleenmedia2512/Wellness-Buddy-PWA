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

function browserLocal() {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch { /* private mode */ }
  return null;
}

export function transformationPhotosCompleteKey(userId) {
  if (userId == null || String(userId).trim() === '') return '';
  return `wv.transformationPhotos.complete.${String(userId).trim()}`;
}

/** All three poses were on the profile the last time this phone read them. */
export function rememberTransformationPhotosComplete(userId, storage = browserLocal()) {
  const key = transformationPhotosCompleteKey(userId);
  if (!key || !storage) return;
  try { storage.setItem(key, '1'); } catch { /* private mode */ }
}

export function readTransformationPhotosComplete(userId, storage = browserLocal()) {
  const key = transformationPhotosCompleteKey(userId);
  if (!key || !storage) return false;
  try { return storage.getItem(key) === '1'; } catch { return false; }
}

/** Do not cover Home with the photo gate when this phone already has all three. */
export function shouldSuppressPhotosStep(step, alreadyComplete) {
  return step === 'photos' && alreadyComplete === true;
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
