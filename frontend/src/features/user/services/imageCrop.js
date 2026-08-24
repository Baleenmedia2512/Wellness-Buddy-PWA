import {
  PROFILE_IMAGE_JPEG_QUALITY,
  PROFILE_IMAGE_MAX_DIMENSION_PX,
  PROFILE_IMAGE_TARGET_BYTES,
} from '../../../shared/constants/limits.js';

/** Downscale source before the rotate/crop canvas so phones do not OOM. */
const MAX_SOURCE_SIDE_PX = 1600;

/**
 * Encode a square canvas as JPEG, stepping quality down until the payload
 * fits PROFILE_IMAGE_TARGET_BYTES (decoded, ~200 KB). Base64 wire size is ~4/3 of that.
 */
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
    img.onerror = () => reject(new Error('Failed to load image for crop'));
    img.src = src;
  });
}

/**
 * If the photo is larger than MAX_SOURCE_SIDE_PX, draw a smaller copy and
 * scale the crop rect to match — keeps the legacy 2× rotate canvas under
 * ~3200px so mobile WebViews can allocate it.
 */
function downscaleSource(img, pixelCrop) {
  const srcMax = Math.max(img.width, img.height);
  if (!(srcMax > MAX_SOURCE_SIDE_PX)) {
    return { source: img, crop: pixelCrop, release: () => {} };
  }

  const scale = MAX_SOURCE_SIDE_PX / srcMax;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  return {
    source: canvas,
    crop: {
      x: pixelCrop.x * scale,
      y: pixelCrop.y * scale,
      width: pixelCrop.width * scale,
      height: pixelCrop.height * scale,
    },
    release: () => {
      canvas.width = 0;
      canvas.height = 0;
    },
  };
}

/**
 * Crop a square region from a base64 image, supporting rotation + flip.
 * Output is capped to PROFILE_IMAGE_MAX_DIMENSION_PX and ≤ ~200 KB JPEG.
 */
export const getCroppedImg = async (
  imageSrc,
  pixelCrop,
  rotation = 0,
  flip = { h: false, v: false },
) => {
  if (!pixelCrop || !(pixelCrop.width > 0) || !(pixelCrop.height > 0)) {
    throw new Error('Invalid crop area — please adjust the crop and try again');
  }

  const img = await loadImage(imageSrc);
  const { source, crop, release } = downscaleSource(img, pixelCrop);
  const maxOut = PROFILE_IMAGE_MAX_DIMENSION_PX || 320;

  try {
    const srcW = source.width;
    const srcH = source.height;
    // Legacy react-easy-crop helper: square canvas = 2 × longest side.
    const size = Math.max(srcW, srcH) * 2;
    if (!(size > 0)) throw new Error('Image has no dimensions');

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas not supported');

    ctx.translate(size / 2, size / 2);
    ctx.rotate(((Number(rotation) || 0) * Math.PI) / 180);
    ctx.scale(flip.h ? -1 : 1, flip.v ? -1 : 1);
    ctx.drawImage(source, -srcW / 2, -srcH / 2);

    const cropSide = Math.min(crop.width, crop.height);
    if (!(cropSide > 0)) {
      throw new Error('Invalid crop area — please adjust the crop and try again');
    }

    const outSize = Math.max(1, Math.min(cropSide, maxOut));
    const out = document.createElement('canvas');
    out.width = outSize;
    out.height = outSize;
    const outCtx = out.getContext('2d');
    if (!outCtx) throw new Error('Canvas not supported');
    outCtx.imageSmoothingEnabled = true;
    try {
      outCtx.imageSmoothingQuality = 'high';
    } catch {
      /* older WebViews */
    }

    outCtx.drawImage(
      canvas,
      crop.x + (size / 2 - srcW / 2),
      crop.y + (size / 2 - srcH / 2),
      crop.width,
      crop.height,
      0,
      0,
      outSize,
      outSize,
    );

    const dataUrl = encodeWithinBudget(out);

    canvas.width = 0;
    canvas.height = 0;
    out.width = 0;
    out.height = 0;

    if (!dataUrl || dataUrl === 'data:,' || !dataUrl.includes(';base64,')) {
      throw new Error('Crop produced an empty image — please try again');
    }
    return dataUrl;
  } finally {
    release();
  }
};
