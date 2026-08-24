import {
  PROFILE_IMAGE_JPEG_QUALITY,
  PROFILE_IMAGE_TARGET_BYTES,
  MAX_IMAGE_DIMENSION_PX,
} from '../../../shared/constants/limits.js';

function encodeWithinBudget(canvas) {
  const targetBytes = PROFILE_IMAGE_TARGET_BYTES || 200 * 1024;
  const startQuality = PROFILE_IMAGE_JPEG_QUALITY || 0.85;
  const maxDataUrlLen = Math.ceil(targetBytes / 0.75) + 32;
  let quality = startQuality;
  let dataUrl = canvas.toDataURL('image/jpeg', quality);
  while (dataUrl.length > maxDataUrlLen && quality > 0.35) {
    quality = Math.round((quality - 0.08) * 100) / 100;
    dataUrl = canvas.toDataURL('image/jpeg', quality);
  }
  return dataUrl;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

/**
 * Convert a picked File into a JPEG data URL using existing profile size limits.
 * Does not crop — transformation photos are full-body, not avatars.
 * @param {File} file
 * @returns {Promise<string>}
 */
export async function fileToProfileJpegDataUrl(file) {
  if (!file || !file.type || !file.type.startsWith('image/')) {
    throw new Error('Please select a valid image file');
  }
  const src = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
  const img = await loadImage(src);
  const maxSide = MAX_IMAGE_DIMENSION_PX || 1600;
  const srcMax = Math.max(img.width, img.height);
  const scale = srcMax > maxSide ? maxSide / srcMax : 1;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Failed to prepare photo. Please try again.');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return encodeWithinBudget(canvas);
}
