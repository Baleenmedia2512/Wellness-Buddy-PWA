/**
 * Optional Front / Left / Right on first-run Complete Profile.
 * Images: existing team_table.transformation_photos JSONB.
 */
import { useCallback, useMemo, useState } from 'react';
import { fileToProfileJpegDataUrl } from '../services/fileToProfileJpegDataUrl';
import {
  DEFAULT_TRANSFORMATION_COMPARE_TYPE,
  TRANSFORMATION_COMPARE_TYPES,
  historyFromLatestSlots,
} from '../domain/transformationBeforeAfter';

const EMPTY_SLOTS = { front: null, left: null, right: null };

export default function useTransformationPhotos() {
  const [selectedType, setSelectedType] = useState(DEFAULT_TRANSFORMATION_COMPARE_TYPE);
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
    if (!file || !TRANSFORMATION_COMPARE_TYPES.includes(slot)) return;
    const dataUrl = await fileToProfileJpegDataUrl(file);
    setPreviews((prev) => ({ ...prev, [slot]: dataUrl }));
    setPendingSlots((prev) => ({ ...prev, [slot]: dataUrl }));
  }, []);

  const applyGuidedSlots = useCallback(async (slots = {}) => {
    const nextPreviews = { ...EMPTY_SLOTS };
    const nextPending = { ...EMPTY_SLOTS };
    for (const key of TRANSFORMATION_COMPARE_TYPES) {
      const value = slots[key];
      if (typeof value === 'string' && value.startsWith('data:image/')) {
        nextPreviews[key] = value;
        nextPending[key] = value;
      }
    }
    setPreviews((prev) => ({
      front: nextPreviews.front || prev.front,
      left: nextPreviews.left || prev.left,
      right: nextPreviews.right || prev.right,
    }));
    setPendingSlots((prev) => ({
      front: nextPending.front || prev.front,
      left: nextPending.left || prev.left,
      right: nextPending.right || prev.right,
    }));
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

  return {
    selectedType,
    setSelectedType,
    previews,
    history,
    loadFromProfile,
    loadFromTestimonial,
    setSnapshotWeight,
    setSlotFromFile,
    applyGuidedSlots,
    payloadExtras,
    leftImageBase64,
  };
}
