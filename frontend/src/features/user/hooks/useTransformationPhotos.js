/**
 * Centre / Left / Right transformation photos for onboarding / profile.
 * Images: team_table.transformation_photos JSONB.
 * Left slot also seeds testimonial Before via persistOnboardingTestimonialPhotos.
 */
import { useCallback, useMemo, useState } from 'react';
import { fileToProfileJpegDataUrl } from '../services/fileToProfileJpegDataUrl';
import { normalizeImageToPortraitJpeg } from '../services/capturePortraitJpeg';
import { historyFromLatestSlots } from '../domain/transformationBeforeAfter';
import { POSE_SLOT_KEYS } from '../domain/transformationPoseGuide';

const EMPTY_SLOTS = { front: null, left: null, right: null };

export default function useTransformationPhotos() {
  const [selectedType, setSelectedType] = useState('front');
  const [previews, setPreviews] = useState(EMPTY_SLOTS);
  const [pendingSlots, setPendingSlots] = useState(EMPTY_SLOTS);
  const [snapshotWeightKg, setSnapshotWeightKg] = useState(null);

  const loadFromProfile = useCallback((stored) => {
    setPreviews({
      front: stored?.front || null,
      left: stored?.left || null,
      right: stored?.right || null,
    });
    setPendingSlots(EMPTY_SLOTS);
  }, []);

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
    const raw = await fileToProfileJpegDataUrl(file);
    const dataUrl = await normalizeImageToPortraitJpeg(raw);
    setPreviews((prev) => ({ ...prev, [slot]: dataUrl }));
    setPendingSlots((prev) => ({ ...prev, [slot]: dataUrl }));
  }, []);

  const history = useMemo(
    () => historyFromLatestSlots(previews, snapshotWeightKg),
    [previews, snapshotWeightKg],
  );

  const payloadExtras = useCallback(() => {
    const extras = {};
    if (pendingSlots.front) extras.front = pendingSlots.front;
    if (pendingSlots.left) extras.left = pendingSlots.left;
    if (pendingSlots.right) extras.right = pendingSlots.right;
    return Object.keys(extras).length > 0 ? { transformationPhotos: extras } : {};
  }, [pendingSlots]);

  const leftImageBase64 = useCallback(() => {
    const value = pendingSlots.left || previews.left;
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return /^data:image\//.test(trimmed) ? trimmed : null;
  }, [pendingSlots.left, previews.left]);

  /** Centre slot — also used as ProfileImage. */
  const frontImageBase64 = useCallback(() => {
    const value = pendingSlots.front || previews.front;
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return /^data:image\//.test(trimmed) ? trimmed : null;
  }, [pendingSlots.front, previews.front]);

  return {
    selectedType,
    setSelectedType,
    previews,
    history,
    loadFromProfile,
    loadFromTestimonial,
    setSnapshotWeight,
    setSlotFromFile,
    payloadExtras,
    leftImageBase64,
    frontImageBase64,
  };
}
