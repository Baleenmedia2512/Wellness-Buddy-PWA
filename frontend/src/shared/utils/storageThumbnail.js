/**
 * Shrink a data-URL / raw base64 image for DB persistence (~22 KB target).
 * AI analysis should keep the larger in-memory image; only call this when
 * writing ImageBase64 / WeightImageBase64 to the API.
 */
import {
  STORAGE_IMAGE_JPEG_QUALITY,
  STORAGE_IMAGE_MAX_DIMENSION_PX,
  STORAGE_IMAGE_TARGET_BYTES,
} from '../constants/limits.js';

function toDataUrl(imageBase64) {
  if (!imageBase64 || typeof imageBase64 !== 'string') return null;
  const trimmed = imageBase64.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('data:')) return trimmed;
  return `data:image/jpeg;base64,${trimmed}`;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image for storage thumb'));
    img.src = src;
  });
}

function encodeWithinBudget(canvas, targetBytesOverride) {
  const targetBytes = targetBytesOverride || STORAGE_IMAGE_TARGET_BYTES || 22 * 1024;
  const startQuality = STORAGE_IMAGE_JPEG_QUALITY || 0.65;
  const maxDataUrlLen = Math.ceil(targetBytes / 0.75) + 32;

  let quality = startQuality;
  let dataUrl = canvas.toDataURL('image/jpeg', quality);

  while (dataUrl.length > maxDataUrlLen && quality > 0.15) {
    quality = Math.round((quality - 0.05) * 100) / 100;
    dataUrl = canvas.toDataURL('image/jpeg', quality);
  }

  return dataUrl;
}

/**
 * @param {string|null|undefined} imageBase64
 * @param {{ targetBytes?: number, maxDim?: number }} [options]
 * @returns {Promise<string|null>} JPEG data URL sized for DB storage, or null
 */
export async function toStorageThumbnail(imageBase64, options = {}) {
  const src = toDataUrl(imageBase64);
  if (!src) return null;

  try {
    const img = await loadImage(src);
    const maxDim = options.maxDim || STORAGE_IMAGE_MAX_DIMENSION_PX || 256;
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height, 1));
    const width = Math.max(1, Math.round(img.width * scale));
    const height = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return src;

    ctx.imageSmoothingEnabled = true;
    try {
      ctx.imageSmoothingQuality = 'medium';
    } catch {
      /* older WebViews */
    }
    ctx.drawImage(img, 0, 0, width, height);

    const dataUrl = encodeWithinBudget(canvas, options.targetBytes);
    canvas.width = 0;
    canvas.height = 0;

    if (!dataUrl || dataUrl === 'data:,' || !dataUrl.includes(';base64,')) {
      return src;
    }
    return dataUrl;
  } catch {
    // Never block save/AI settle if thumb generation fails — keep original.
    return src;
  }
}
