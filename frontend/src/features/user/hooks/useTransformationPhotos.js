/**
 * Optional Front / Left / Right transformation photos on Profile.
 * None of the slots is required; save works with zero uploads.
 */
import { useCallback, useState } from 'react';
import { fileToProfileJpegDataUrl } from '../services/fileToProfileJpegDataUrl';

const EMPTY = { front: null, left: null, right: null };

export default function useTransformationPhotos() {
  const [previews, setPreviews] = useState(EMPTY);
  const [pending, setPending] = useState(EMPTY);
  const [history, setHistory] = useState([]);

  const loadFromProfile = useCallback((stored, historyRows) => {
    setPreviews({
      front: stored?.front || null,
      left: stored?.left || null,
      right: stored?.right || null,
    });
    setPending(EMPTY);
    setHistory(Array.isArray(historyRows) ? historyRows : []);
  }, []);

  const setSlotFromFile = useCallback(async (slot, file) => {
    if (!file) return;
    const dataUrl = await fileToProfileJpegDataUrl(file);
    setPreviews((prev) => ({ ...prev, [slot]: dataUrl }));
    setPending((prev) => ({ ...prev, [slot]: dataUrl }));
  }, []);

  const payloadExtras = useCallback(() => {
    const extras = {};
    if (pending.front) extras.front = pending.front;
    if (pending.left) extras.left = pending.left;
    if (pending.right) extras.right = pending.right;
    return Object.keys(extras).length > 0 ? { transformationPhotos: extras } : {};
  }, [pending]);

  return { previews, history, loadFromProfile, setSlotFromFile, payloadExtras };
}
