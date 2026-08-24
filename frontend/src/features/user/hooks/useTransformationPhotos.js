/**
 * Optional Front / Left / Right on first-run Complete Profile.
 * Images: existing team_table.transformation_photos JSONB.
 * Left Before vs After weights: existing testimonials_table.
 */
import { useCallback, useMemo, useState } from 'react';
import { fileToProfileJpegDataUrl } from '../services/fileToProfileJpegDataUrl';
import {
  DEFAULT_TRANSFORMATION_COMPARE_TYPE,
  TRANSFORMATION_COMPARE_TYPES,
  historyFromLatestSlots,
  mapTestimonialToCompareHistory,
  mergeCompareHistory,
  overlayPendingCompareHistory,
} from '../domain/transformationBeforeAfter';

const EMPTY_SLOTS = { front: null, left: null, right: null };
const EMPTY_PAIR = { before: null, after: null };

export default function useTransformationPhotos() {
  const [selectedType, setSelectedType] = useState(DEFAULT_TRANSFORMATION_COMPARE_TYPE);
  const [previews, setPreviews] = useState(EMPTY_SLOTS);
  const [pendingSlots, setPendingSlots] = useState(EMPTY_SLOTS);
  const [pendingPair, setPendingPair] = useState(EMPTY_PAIR);
  const [testimonialHistory, setTestimonialHistory] = useState([]);
  const [snapshotWeightKg, setSnapshotWeightKg] = useState(null);

  const loadFromProfile = useCallback((stored) => {
    setPreviews({
      front: stored?.front || null,
      left: stored?.left || null,
      right: stored?.right || null,
    });
    setPendingSlots(EMPTY_SLOTS);
    setPendingPair(EMPTY_PAIR);
  }, []);

  const loadFromTestimonial = useCallback((testimonial, weightKg) => {
    setTestimonialHistory(mapTestimonialToCompareHistory(testimonial));
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
    if (slot !== 'left') return;
    setPendingPair((prev) => {
      const hasBefore = testimonialHistory.some((row) => row.imageType === 'left')
        || Boolean(prev.before);
      if (!hasBefore) return { ...prev, before: dataUrl };
      return { ...prev, after: dataUrl };
    });
  }, [testimonialHistory]);

  const history = useMemo(() => {
    const fromSlots = historyFromLatestSlots(previews);
    const merged = mergeCompareHistory(fromSlots, testimonialHistory);
    return overlayPendingCompareHistory(merged, pendingPair, snapshotWeightKg);
  }, [previews, testimonialHistory, pendingPair, snapshotWeightKg]);

  const payloadExtras = useCallback(() => {
    const extras = {};
    if (pendingSlots.front) extras.front = pendingSlots.front;
    if (pendingSlots.left) extras.left = pendingSlots.left;
    if (pendingSlots.right) extras.right = pendingSlots.right;
    return Object.keys(extras).length > 0 ? { transformationPhotos: extras } : {};
  }, [pendingSlots]);

  const testimonialPayload = useCallback(() => {
    if (pendingPair.before || pendingPair.after) {
      return {
        beforeImageBase64: pendingPair.before || undefined,
        afterImageBase64: pendingPair.after || undefined,
      };
    }
    return {};
  }, [pendingPair]);

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
    testimonialPayload,
  };
}
