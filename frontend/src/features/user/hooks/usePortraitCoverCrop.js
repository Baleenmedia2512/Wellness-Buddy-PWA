/**
 * Portrait 9:16 cover-crop after a Left/Centre/Right or Before/After pick.
 * Aspect stays locked; corner dots resize the frame, then pan/zoom fills it.
 */
import React, { useCallback, useRef } from 'react';
import useImageCropper from './useImageCropper';
import { getCroppedImg } from '../services/imageCrop';
import CropOverlay from '../components/shared/CropOverlay';
import { compressImage } from '../../testimonials/utils/compressTestimonialImage.js';
import { setCaptureFlowBusy } from '../../../shared/services/captureFlowBusy';

export const PORTRAIT_COVER_ASPECT = 9 / 16;

const PORTRAIT_CROP_OPTS = {
  square: false,
  maxDimension: 1200,
  targetBytes: 900 * 1024,
  startQuality: 0.85,
};

function cropPortraitCover(src, pixels, rotation) {
  return getCroppedImg(src, pixels, rotation, PORTRAIT_CROP_OPTS);
}

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

  const cropper = useImageCropper({
    aspect: PORTRAIT_COVER_ASPECT,
    cropShape: 'rect',
    objectFit: 'cover',
    title: 'Adjust photo',
    hint: 'Drag corner dots to resize · drag or pinch to move',
    cropImage: cropPortraitCover,
    onError: (msg) => onErrorRef.current?.(msg),
    onCropped: (dataUrl) => onApplyRef.current?.(dataUrl, pendingKeyRef.current),
  });

  const pickFile = useCallback(async (file, key = 'default') => {
    if (!file) return;
    pendingKeyRef.current = key;
    setCaptureFlowBusy(true);
    try {
      const { preview } = await compressImage(file);
      lastSourceRef.current[key] = preview;
      await cropper.openExistingImage(preview, { replace: true });
    } catch (err) {
      onErrorRef.current?.(err?.message || 'Failed to prepare photo.');
    } finally {
      setCaptureFlowBusy(false);
    }
  }, [cropper]);

  const recrop = useCallback(async (src, key = 'default') => {
    pendingKeyRef.current = key;
    const source = lastSourceRef.current[key] || src;
    if (!source) return;
    await cropper.openExistingImage(source, { replace: true });
  }, [cropper]);

  const overlay = cropper.showCropper && cropper.rawImageSrc ? (
    <CropOverlay
      {...cropper}
      resizable
      onCancel={cropper.cancelCropper}
      onDone={cropper.apply}
      zIndex={zIndex}
    />
  ) : null;

  return {
    pickFile,
    recrop,
    overlay,
    isPreparing: cropper.isPreparingCrop,
  };
}
