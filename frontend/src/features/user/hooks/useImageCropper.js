// Image cropper state — handles file selection, crop/zoom/rotation, apply.
// On apply, calls onCropped(base64) with the resulting JPEG data URL.
import { useCallback, useRef, useState } from 'react';
import { getCroppedImg } from '../services/imageCrop';

export default function useImageCropper({ onCropped, onError } = {}) {
  const [rawImageSrc, setRawImageSrc] = useState(null);
  const [showCropper, setShowCropper] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

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
    if (file.size > 5 * 1024 * 1024) {
      onError?.('Image size must be less than 5MB');
      return;
    }
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
      const cropped = await getCroppedImg(rawImageSrc, croppedAreaPixels, rotation);
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
  }, [rawImageSrc, croppedAreaPixels, rotation, onCropped, onError]);

  const reopenCropper = () => {
    if (!rawImageSrc) return;
    reset();
    setShowCropper(true);
  };

  const cancelCropper = () => {
    setShowCropper(false);
    setRawImageSrc(null);
  };

  return {
    rawImageSrc, showCropper, crop, zoom, rotation,
    setCrop, setZoom, setRotation, onCropComplete,
    fileInputRef, cameraInputRef,
    selectFile, apply, reopenCropper, cancelCropper,
  };
}
