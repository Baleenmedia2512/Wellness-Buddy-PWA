/**
 * Save a free-quad selection as a JPEG.
 * Uses the selection's bounding rectangle + a phone-safe canvas crop.
 */
import { coverCropOutputSize } from './imageCrop.js';

/** @typedef {{ x: number, y: number }} Pt */
/** @typedef {{ tl: Pt, tr: Pt, br: Pt, bl: Pt }} Quad */

export function axisAlignedBounds(quad) {
  const xs = [quad.tl.x, quad.tr.x, quad.br.x, quad.bl.x].map(Number);
  const ys = [quad.tl.y, quad.tr.y, quad.br.y, quad.bl.y].map(Number);
  if (xs.some((n) => !Number.isFinite(n)) || ys.some((n) => !Number.isFinite(n))) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return {
    x,
    y,
    width: Math.max(...xs) - x,
    height: Math.max(...ys) - y,
  };
}

/** Clamp a pixel crop so it stays inside the bitmap. */
export function clampPixelCrop(box, imgW, imgH) {
  const maxW = Math.max(1, Math.floor(Number(imgW) || 0));
  const maxH = Math.max(1, Math.floor(Number(imgH) || 0));
  let x = Math.max(0, Math.floor(Number(box?.x) || 0));
  let y = Math.max(0, Math.floor(Number(box?.y) || 0));
  let width = Math.max(1, Math.floor(Number(box?.width) || 0));
  let height = Math.max(1, Math.floor(Number(box?.height) || 0));
  if (x >= maxW) x = Math.max(0, maxW - 1);
  if (y >= maxH) y = Math.max(0, maxH - 1);
  if (x + width > maxW) width = Math.max(1, maxW - x);
  if (y + height > maxH) height = Math.max(1, maxH - y);
  return { x, y, width, height };
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (/^https?:\/\//i.test(String(src || ''))) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image for free crop'));
    img.src = src;
  });
}

function encodeJpegWithinBytes(canvas, targetBytes, startQuality) {
  const maxDataUrlLen = Math.ceil((targetBytes || 900 * 1024) / 0.75) + 32;
  let quality = startQuality || 0.85;
  let dataUrl = canvas.toDataURL('image/jpeg', quality);
  while (dataUrl.length > maxDataUrlLen && quality > 0.15) {
    quality = Math.round((quality - 0.05) * 100) / 100;
    dataUrl = canvas.toDataURL('image/jpeg', quality);
  }
  return dataUrl;
}

/**
 * Direct drawImage crop — no giant rotate canvas (avoids WebView OOM / hang on Done).
 */
async function cropRectToDataUrl(imageSrc, pixelCrop, {
  targetBytes = 900 * 1024,
  startQuality = 0.85,
  maxDimension = 1200,
} = {}) {
  const img = await loadImage(imageSrc);
  const imgW = img.naturalWidth || img.width;
  const imgH = img.naturalHeight || img.height;
  const crop = clampPixelCrop(pixelCrop, imgW, imgH);
  if (!(crop.width > 1) || !(crop.height > 1)) {
    throw new Error('Crop area is too small — pull the corners out a bit');
  }

  const outSize = coverCropOutputSize(crop.width, crop.height, maxDimension || 1200);
  const out = document.createElement('canvas');
  out.width = outSize.width;
  out.height = outSize.height;
  const ctx = out.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  ctx.imageSmoothingEnabled = true;
  try { ctx.imageSmoothingQuality = 'high'; } catch { /* older WebViews */ }

  ctx.drawImage(
    img,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    outSize.width,
    outSize.height,
  );

  const dataUrl = encodeJpegWithinBytes(out, targetBytes, startQuality);
  out.width = 0;
  out.height = 0;

  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.includes(';base64,')) {
    throw new Error('Free crop produced an empty image — please try again');
  }
  return dataUrl;
}

/**
 * @param {string} imageSrc
 * @param {Quad} naturalQuad — corners in natural image pixels
 */
export async function warpQuadToDataUrl(imageSrc, naturalQuad, _dstW, _dstH, opts = {}) {
  if (!naturalQuad) throw new Error('Invalid free-crop area');
  if (!imageSrc) throw new Error('No image to crop');

  const box = axisAlignedBounds(naturalQuad);
  if (!(box.width > 2) || !(box.height > 2)) {
    throw new Error('Crop area is too small — pull the corners out a bit');
  }

  return cropRectToDataUrl(imageSrc, box, {
    targetBytes: opts.targetBytes || 900 * 1024,
    startQuality: opts.startQuality || 0.85,
    maxDimension: opts.maxDimension || 1200,
  });
}

/** Test helper — 9 values; no longer used for save. */
export function perspectiveMatrix(srcQuad, dstW, dstH) {
  const w = Number(dstW) || 1;
  const h = Number(dstH) || 1;
  const sx = (srcQuad?.tr?.x - srcQuad?.tl?.x) / w || 1;
  const sy = (srcQuad?.bl?.y - srcQuad?.tl?.y) / h || 1;
  return [sx, 0, srcQuad?.tl?.x || 0, 0, sy, srcQuad?.tl?.y || 0, 0, 0, 1];
}
