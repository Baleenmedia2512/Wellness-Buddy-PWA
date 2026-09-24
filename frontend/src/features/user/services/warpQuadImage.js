/**
 * Save a free-quad selection as a JPEG.
 * Uses the selection's bounding rectangle + the proven getCroppedImg path
 * (phone-safe downscale). Corner UI stays free-form; Done always saves.
 */
import { getCroppedImg } from './imageCrop.js';

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

/**
 * @param {string} imageSrc
 * @param {Quad} naturalQuad — corners in natural image pixels
 * @param {number} [_dstW] unused (size comes from the crop + maxDimension)
 * @param {number} [_dstH] unused
 * @param {{ targetBytes?: number, startQuality?: number, maxDimension?: number }} [opts]
 */
export async function warpQuadToDataUrl(imageSrc, naturalQuad, _dstW, _dstH, {
  targetBytes = 900 * 1024,
  startQuality = 0.85,
  maxDimension = 1200,
} = {}) {
  if (!naturalQuad) throw new Error('Invalid free-crop area');
  if (!imageSrc) throw new Error('No image to crop');

  const box = axisAlignedBounds(naturalQuad);
  if (!(box.width > 2) || !(box.height > 2)) {
    throw new Error('Crop area is too small — pull the corners out a bit');
  }

  // Pad 1px inward so float rounding never samples outside the bitmap.
  const pixelCrop = {
    x: Math.max(0, Math.floor(box.x)),
    y: Math.max(0, Math.floor(box.y)),
    width: Math.max(1, Math.floor(box.width)),
    height: Math.max(1, Math.floor(box.height)),
  };

  const dataUrl = await getCroppedImg(imageSrc, pixelCrop, 0, {
    square: false,
    maxDimension: maxDimension || 1200,
    targetBytes: targetBytes || 900 * 1024,
    startQuality: startQuality || 0.85,
  });

  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.includes(';base64,')) {
    throw new Error('Free crop produced an empty image — please try again');
  }
  return dataUrl;
}

/** Test helper — 9 values; no longer used for save. */
export function perspectiveMatrix(srcQuad, dstW, dstH) {
  const w = Number(dstW) || 1;
  const h = Number(dstH) || 1;
  const sx = (srcQuad?.tr?.x - srcQuad?.tl?.x) / w || 1;
  const sy = (srcQuad?.bl?.y - srcQuad?.tl?.y) / h || 1;
  return [sx, 0, srcQuad?.tl?.x || 0, 0, sy, srcQuad?.tl?.y || 0, 0, 0, 1];
}
