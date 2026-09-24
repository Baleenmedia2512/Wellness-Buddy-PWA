/**
 * Free-quad crop after a Left/Centre/Right or Before/After pick.
 * Each corner moves independently (like document / free crop tools);
 * Done perspective-warps the selection into a rectangle for the card.
 */
import React, { useCallback, useRef, useState } from 'react';
import { imageSrcToDataUrl } from '../services/imageCrop';
import FreeQuadCropOverlay from '../components/shared/FreeQuadCropOverlay';
import { compressImage } from '../../testimonials/utils/compressTestimonialImage.js';
import { setCaptureFlowBusy } from '../../../shared/services/captureFlowBusy';

export const PORTRAIT_COVER_ASPECT = 9 / 16;

/** Above onboarding full-screens (zIndex 9999) so Adjust/Done is reachable. */
const DEFAULT_CROP_Z_INDEX = 10050;

/**
 * @param {{
 *   onApply: (dataUrl: string, key?: string) => void | Promise<void>,
 *   onError?: (message: string) => void,
 *   zIndex?: number,
 * }} opts
 */
export default function usePortraitCoverCrop({ onApply, onError, zIndex = DEFAULT_CROP_Z_INDEX } = {}) {
  const lastSourceRef = useRef({});
  const pendingKeyRef = useRef('default');
  const onApplyRef = useRef(onApply);
  onApplyRef.current = onApply;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const openRequestRef = useRef(0);
  const rawImageSrcRef = useRef(null);

  const [rawImageSrc, setRawImageSrc] = useState(null);
  const [showCropper, setShowCropper] = useState(false);
  const [isPreparingCrop, setIsPreparingCrop] = useState(false);
  rawImageSrcRef.current = rawImageSrc;

  const close = useCallback(() => {
    openRequestRef.current += 1;
    setShowCropper(false);
    setRawImageSrc(null);
    setIsPreparingCrop(false);
  }, []);

  const openSrc = useCallback(async (src, { replace = false } = {}) => {
    if (!src) return;
    if (rawImageSrcRef.current && !replace) {
      setShowCropper(true);
      return;
    }
    const requestId = openRequestRef.current + 1;
    openRequestRef.current = requestId;
    setIsPreparingCrop(true);
    try {
      const resolved = await imageSrcToDataUrl(src);
      if (openRequestRef.current !== requestId) return;
      setRawImageSrc(resolved);
      setShowCropper(true);
    } catch (err) {
      if (openRequestRef.current !== requestId) return;
      // eslint-disable-next-line no-console -- recrop load failures need device logs
      console.error('[portrait-crop] openSrc failed:', err);
      onErrorRef.current?.('Could not open this photo for crop. Please upload a new image.');
    } finally {
      if (openRequestRef.current === requestId) {
        setIsPreparingCrop(false);
      }
    }
  }, []);

  const pickFile = useCallback(async (file, key = 'default') => {
    if (!file) return;
    pendingKeyRef.current = key;
    setCaptureFlowBusy(true);
    try {
      const { preview } = await compressImage(file);
      lastSourceRef.current[key] = preview;
      await openSrc(preview, { replace: true });
    } catch (err) {
      onErrorRef.current?.(err?.message || 'Failed to prepare photo.');
    } finally {
      setCaptureFlowBusy(false);
    }
  }, [openSrc]);

  const recrop = useCallback(async (src, key = 'default') => {
    pendingKeyRef.current = key;
    const source = lastSourceRef.current[key] || src;
    if (!source) return;
    await openSrc(source, { replace: true });
  }, [openSrc]);

  const handleDone = useCallback(async (dataUrl) => {
    try {
      await onApplyRef.current?.(dataUrl, pendingKeyRef.current);
    } catch (callbackErr) {
      // eslint-disable-next-line no-console -- post-crop callback failures need device logs
      console.error('[portrait-crop] onApply failed:', callbackErr);
      onErrorRef.current?.('Failed to process cropped image. Please try again.');
      throw callbackErr;
    }
    setShowCropper(false);
    setRawImageSrc(null);
  }, []);

  const overlay = showCropper && rawImageSrc ? (
    <FreeQuadCropOverlay
      rawImageSrc={rawImageSrc}
      title="Adjust photo"
      hint="Drag any corner freely · edge dots move a side · drag inside to move all"
      onCancel={close}
      onDone={handleDone}
      zIndex={zIndex}
    />
  ) : null;

  return {
    pickFile,
    recrop,
    overlay,
    isPreparing: isPreparingCrop,
  };
}
