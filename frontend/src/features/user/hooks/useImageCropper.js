// Image cropper state — handles file selection, crop/zoom/rotation, apply.
// On apply, calls onCropped(base64) with the resulting JPEG data URL.
import { useCallback, useRef, useState } from 'react';
import { getCroppedImg, imageSrcToDataUrl } from '../services/imageCrop';

export default function useImageCropper({
  onCropped,
  onError,
  cropImage = getCroppedImg,
  aspect = 1,
  cropShape = 'round',
  title = 'Crop Photo',
  hint = '',
  objectFit = 'contain',
} = {}) {
  const [rawImageSrc, setRawImageSrc] = useState(null);
  const [showCropper, setShowCropper] = useState(false);
  const [isPreparingCrop, setIsPreparingCrop] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const rawImageSrcRef = useRef(null);
  const isPreparingCropRef = useRef(false);
  const openRequestRef = useRef(0);
  rawImageSrcRef.current = rawImageSrc;

  const reset = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
  };

  const selectFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      onError?.('Please select a valid image file');
      return;
    }
    // No pick-time size cap — crop + encodeWithinBudget compresses to
    // PROFILE_IMAGE_TARGET_BYTES (~22 KB) before save/upload.
    const reader = new FileReader();
    reader.onload = (e) => {
      setRawImageSrc(e.target.result);
      reset();
      setShowCropper(true);
    };
    reader.onerror = () => onError?.('Failed to read image file');
    reader.readAsDataURL(file);
  };

  const onCropComplete = useCallback((_, pixels) => setCroppedAreaPixels(pixels), []);

  const apply = useCallback(async () => {
    if (!rawImageSrc || !croppedAreaPixels) return;
    try {
      const cropped = await cropImage(rawImageSrc, croppedAreaPixels, rotation);
      setShowCropper(false);
      try {
        onCropped?.(cropped);
      } catch (callbackErr) {
        // eslint-disable-next-line no-console -- post-crop callback failures need device logs
        console.error('[profile-crop] onCropped callback failed:', callbackErr);
        onError?.('Failed to process cropped image. Please try again.');
      }
    } catch (err) {
      // eslint-disable-next-line no-console -- crop failures need a console trail on device
      console.error('[profile-crop] getCroppedImg failed:', err);
      onError?.('Failed to crop image. Please try again.');
    }
  }, [rawImageSrc, croppedAreaPixels, rotation, onCropped, onError, cropImage]);

  const reopenCropper = () => {
    if (!rawImageSrcRef.current) return;
    reset();
    setShowCropper(true);
  };

  const closeCropper = () => {
    setShowCropper(false);
  };

  const cancelCropper = () => {
    openRequestRef.current += 1;
    isPreparingCropRef.current = false;
    setIsPreparingCrop(false);
    setShowCropper(false);
    setRawImageSrc(null);
  };

  const openExistingImage = useCallback(async (src, { fallbackSrc, replace = false } = {}) => {
    if (rawImageSrcRef.current && !replace) {
      reset();
      setShowCropper(true);
      return;
    }
    if (!src && !fallbackSrc) return;
    if (isPreparingCropRef.current) return;
    const requestId = openRequestRef.current + 1;
    openRequestRef.current = requestId;
    isPreparingCropRef.current = true;
    setIsPreparingCrop(true);
    try {
      const resolved = await imageSrcToDataUrl(src, { fallbackSrc });
      if (openRequestRef.current !== requestId) return;
      setRawImageSrc(resolved);
      reset();
      setShowCropper(true);
    } catch (err) {
      if (openRequestRef.current !== requestId) return;
      // eslint-disable-next-line no-console -- recrop load failures need device logs
      console.error('[profile-crop] openExistingImage failed:', err);
      onError?.('Could not open this photo for crop. Please upload a new image.');
    } finally {
      if (openRequestRef.current === requestId) {
        isPreparingCropRef.current = false;
        setIsPreparingCrop(false);
      }
    }
  }, [onError]);

  return {
    rawImageSrc, showCropper, isPreparingCrop, crop, zoom, rotation,
    setCrop, setZoom, setRotation, onCropComplete,
    fileInputRef, cameraInputRef,
    selectFile, apply, reopenCropper, openExistingImage, closeCropper, cancelCropper,
    aspect, cropShape, title, hint, objectFit,
  };
}
