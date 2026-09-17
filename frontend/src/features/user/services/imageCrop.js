import {
  PROFILE_IMAGE_JPEG_QUALITY,
  PROFILE_IMAGE_MAX_DIMENSION_PX,
  PROFILE_IMAGE_TARGET_BYTES,
} from '../../../shared/constants/limits.js';

/** Downscale source before the rotate/crop canvas so phones do not OOM. */
const MAX_SOURCE_SIDE_PX = 1600;

function encodeJpegWithinBytes(canvas, targetBytes, startQuality) {
  const maxDataUrlLen = Math.ceil((targetBytes || 22 * 1024) / 0.75) + 32;
  let quality = startQuality || 0.65;
  let dataUrl = canvas.toDataURL('image/jpeg', quality);

  while (dataUrl.length > maxDataUrlLen && quality > 0.15) {
    quality = Math.round((quality - 0.05) * 100) / 100;
    dataUrl = canvas.toDataURL('image/jpeg', quality);
  }

  return dataUrl;
}

/**
 * Encode a square canvas as JPEG, stepping quality down until the payload
 * fits PROFILE_IMAGE_TARGET_BYTES (decoded, ~22 KB). Base64 wire size is ~4/3 of that.
 */
function encodeWithinBudget(canvas) {
  return encodeJpegWithinBytes(
    canvas,
    PROFILE_IMAGE_TARGET_BYTES || 22 * 1024,
    PROFILE_IMAGE_JPEG_QUALITY || 0.65,
  );
}

/**
 * Scale a crop rectangle so its longest side is at most maxDimension,
 * without stretching (aspect ratio is preserved).
 */
export function coverCropOutputSize(cropW, cropH, maxDimension) {
  const w = Number(cropW) || 0;
  const h = Number(cropH) || 0;
  const max = Number(maxDimension) || 0;
  if (!(w > 0) || !(h > 0) || !(max > 0)) {
    return { width: Math.max(1, Math.round(w) || 1), height: Math.max(1, Math.round(h) || 1) };
  }
  const scale = Math.min(1, max / Math.max(w, h));
  return {
    width: Math.max(1, Math.round(w * scale)),
    height: Math.max(1, Math.round(h * scale)),
  };
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (/^https?:\/\//i.test(String(src || ''))) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image for crop'));
    img.src = src;
  });
}

function blobToDataUrl(blob) {
  if (typeof FileReader === 'function') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Failed to read image for crop'));
      reader.readAsDataURL(blob);
    });
  }
  return blob.arrayBuffer().then((buffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    const b64 = typeof Buffer !== 'undefined'
      ? Buffer.from(bytes).toString('base64')
      : btoa(binary);
    const type = blob.type || 'image/jpeg';
    return `data:${type};base64,${b64}`;
  });
}

/**
 * Turn a preview src (data URI, blob URL, or https) into a data URI the
 * cropper/canvas can read. `fallbackSrc` is typically same-origin
 * `/api/user/avatar?inline=1` when R2/Google CORS blocks the display URL.
 */
export async function imageSrcToDataUrl(src, { fallbackSrc, fetchImpl } = {}) {
  const fetchFn = fetchImpl || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);

  const tryOne = async (url) => {
    if (!url || typeof url !== 'string') {
      throw new Error('No image to crop');
    }
    const trimmed = url.trim();
    if (trimmed.startsWith('data:image/')) return trimmed;
    if (!fetchFn) throw new Error('Failed to load image for crop');
    const res = await fetchFn(trimmed);
    if (!res?.ok) throw new Error('Failed to load image for crop');
    const blob = await res.blob();
    if (!blob || !blob.size) throw new Error('Failed to load image for crop');
    const dataUrl = await blobToDataUrl(blob);
    if (!dataUrl || !dataUrl.startsWith('data:image/')) {
      throw new Error('Failed to load image for crop');
    }
    return dataUrl;
  };

  try {
    return await tryOne(src);
  } catch (err) {
    if (fallbackSrc && fallbackSrc !== src) {
      return tryOne(fallbackSrc);
    }
    throw err instanceof Error ? err : new Error('Failed to load image for crop');
  }
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
 * Crop a region from a base64 image, supporting rotation + flip.
 * Square output (default) is capped to PROFILE_IMAGE_MAX_DIMENSION_PX and ≤ ~22 KB JPEG.
 * Pass `{ square: false }` for portrait cover frames (keeps crop aspect).
 */
export const getCroppedImg = async (
  imageSrc,
  pixelCrop,
  rotation = 0,
  flipOrOpts = { h: false, v: false },
  maybeOpts = {},
) => {
  const optsLooks = Boolean(
    flipOrOpts
    && (flipOrOpts.square === false || flipOrOpts.maxDimension || flipOrOpts.targetBytes),
  );
  const flip = optsLooks ? { h: false, v: false } : (flipOrOpts || { h: false, v: false });
  const opts = optsLooks ? flipOrOpts : (maybeOpts || {});
  if (!pixelCrop || !(pixelCrop.width > 0) || !(pixelCrop.height > 0)) {
    throw new Error('Invalid crop area — please adjust the crop and try again');
  }

  const img = await loadImage(imageSrc);
  const { source, crop, release } = downscaleSource(img, pixelCrop);
  const square = opts.square !== false;
  const maxOut = opts.maxDimension
    || (square ? (PROFILE_IMAGE_MAX_DIMENSION_PX || 256) : 1200);

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

    if (!(crop.width > 0) || !(crop.height > 0)) {
      throw new Error('Invalid crop area — please adjust the crop and try again');
    }

    const outSize = square
      ? { width: Math.max(1, Math.min(Math.min(crop.width, crop.height), maxOut)), height: 0 }
      : coverCropOutputSize(crop.width, crop.height, maxOut);
    if (square) outSize.height = outSize.width;

    const out = document.createElement('canvas');
    out.width = outSize.width;
    out.height = outSize.height;
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
      outSize.width,
      outSize.height,
    );

    const dataUrl = opts.targetBytes
      ? encodeJpegWithinBytes(out, opts.targetBytes, opts.startQuality || 0.85)
      : encodeWithinBudget(out);

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
