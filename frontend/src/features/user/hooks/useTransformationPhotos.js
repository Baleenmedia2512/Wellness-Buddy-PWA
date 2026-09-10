/**
 * Left / Centre / Right transformation photos for onboarding / profile.
 * Images: team_table.transformation_photos JSONB.
 * Left slot also seeds testimonial Before via persistOnboardingTestimonialPhotos.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { compressImage } from '../../testimonials/utils/compressTestimonialImage.js';
import { setCaptureFlowBusy } from '../../../shared/services/captureFlowBusy';
import { historyFromLatestSlots } from '../domain/transformationBeforeAfter';
import { DEFAULT_POSE_SLOT, POSE_SLOT_KEYS } from '../domain/transformationPoseGuide';
import {
  buildTransformationPhotoPayload,
  hasPendingTransformationUploads,
  isDataImageUrl,
  mergePreviewsPreservingPending,
} from '../domain/transformationPhotosPending.js';

const EMPTY_SLOTS = { front: null, left: null, right: null };

export default function useTransformationPhotos() {
  const [selectedType, setSelectedType] = useState(DEFAULT_POSE_SLOT);
  const [previews, setPreviews] = useState(EMPTY_SLOTS);
  const [pendingSlots, setPendingSlots] = useState(EMPTY_SLOTS);
  const pendingRef = useRef(EMPTY_SLOTS);
  const [snapshotWeightKg, setSnapshotWeightKg] = useState(null);

  const setPending = useCallback((next) => {
    const value = typeof next === 'function' ? next(pendingRef.current) : next;
    pendingRef.current = value;
    setPendingSlots(value);
  }, []);

  const loadFromProfile = useCallback((stored) => {
    // Never wipe in-progress uploads — existing users often re-fetch profile mid-edit.
    setPreviews(mergePreviewsPreservingPending(stored, pendingRef.current));
  }, []);

  const clearPending = useCallback(() => {
    setPending(EMPTY_SLOTS);
  }, [setPending]);

  const loadFromTestimonial = useCallback((_testimonial, weightKg) => {
    const n = weightKg != null ? parseFloat(weightKg) : NaN;
    setSnapshotWeightKg(Number.isFinite(n) ? n : null);
  }, []);

  const setSnapshotWeight = useCallback((weightKg) => {
    const n = weightKg != null ? parseFloat(weightKg) : NaN;
    setSnapshotWeightKg(Number.isFinite(n) ? n : null);
  }, []);

  const setSlotFromFile = useCallback(async (slot, file) => {
    if (!file || !POSE_SLOT_KEYS.includes(slot)) return;
    setCaptureFlowBusy(true);
    try {
      const { preview } = await compressImage(file);
      setPreviews((prev) => ({ ...prev, [slot]: preview }));
      setPending((prev) => ({ ...prev, [slot]: preview }));
    } finally {
      setCaptureFlowBusy(false);
    }
  }, [setPending]);

  const history = useMemo(
    () => historyFromLatestSlots(previews, snapshotWeightKg),
    [previews, snapshotWeightKg],
  );

  const payloadExtras = useCallback((options = {}) => (
    buildTransformationPhotoPayload(pendingSlots, previews, options)
  ), [pendingSlots, previews]);

  const hasPendingUploads = useCallback(
    () => hasPendingTransformationUploads(pendingSlots),
    [pendingSlots],
  );

  const leftImageBase64 = useCallback(() => {
    const value = pendingSlots.left || previews.left;
    return isDataImageUrl(value) ? value.trim() : null;
  }, [pendingSlots.left, previews.left]);

  /** Centre slot — also used as ProfileImage. Prefer pending (newly uploaded). */
  const frontImageBase64 = useCallback(() => {
    const value = pendingSlots.front || previews.front;
    return isDataImageUrl(value) ? value.trim() : null;
  }, [pendingSlots.front, previews.front]);

  return {
    selectedType,
    setSelectedType,
    previews,
    history,
    loadFromProfile,
    clearPending,
    loadFromTestimonial,
    setSnapshotWeight,
    setSlotFromFile,
    payloadExtras,
    hasPendingUploads,
    leftImageBase64,
    frontImageBase64,
  };
}
