/**
 * Higher-clarity JPEG for profile avatar + transformation photos.
 * Food / weight / diary thumbs stay on avatarJpeg.js (≤22 KB).
 */
import sharp from 'sharp';

/** Profile avatar — preserve face clarity (not the 22 KB diary thumb). */
export const PROFILE_CLARITY_MAX_SIDE_PX = 1080;
export const PROFILE_CLARITY_TARGET_BYTES = 300 * 1024;
export const PROFILE_CLARITY_JPEG_QUALITY_START = 90;
export const PROFILE_CLARITY_JPEG_QUALITY_MIN = 70;
export const PROFILE_CLARITY_MIN_SIDE_PX = 512;

/** Left / Centre / Right transformation — keep body detail close to the pick. */
export const TRANSFORM_CLARITY_MAX_SIDE_PX = 1920;
export const TRANSFORM_CLARITY_TARGET_BYTES = 800 * 1024;
export const TRANSFORM_CLARITY_JPEG_QUALITY_START = 92;
export const TRANSFORM_CLARITY_JPEG_QUALITY_MIN = 72;
export const TRANSFORM_CLARITY_MIN_SIDE_PX = 960;

/**
 * @param {Buffer} input
 * @param {{
 *   maxSidePx: number,
 *   targetBytes: number,
 *   qualityStart: number,
 *   qualityMin: number,
 *   minSidePx: number,
 * }} budget
 * @returns {Promise<{ bytes: Buffer, contentType: 'image/jpeg' }>}
 */
export async function compressClarityJpeg(input, budget) {
  if (!Buffer.isBuffer(input) || !input.length) {
    throw new Error('Image is empty');
  }

  const maxSide = Number(budget.maxSidePx) || PROFILE_CLARITY_MAX_SIDE_PX;
  const targetBytes = Number(budget.targetBytes) || PROFILE_CLARITY_TARGET_BYTES;
  const qualityStart = Number(budget.qualityStart) || PROFILE_CLARITY_JPEG_QUALITY_START;
  const qualityMin = Number(budget.qualityMin) || PROFILE_CLARITY_JPEG_QUALITY_MIN;
  const minSide = Number(budget.minSidePx) || PROFILE_CLARITY_MIN_SIDE_PX;

  let quality = qualityStart;
  let side = maxSide;
  let bytes = await encodeAt(input, side, quality);

  while (bytes.length > targetBytes && quality > qualityMin) {
    quality -= 3;
    bytes = await encodeAt(input, side, quality);
  }

  while (bytes.length > targetBytes && side > minSide) {
    side = Math.max(minSide, side - 80);
    bytes = await encodeAt(input, side, qualityMin);
  }

  return { bytes, contentType: 'image/jpeg' };
}

export function compressProfileJpeg(input) {
  return compressClarityJpeg(input, {
    maxSidePx: PROFILE_CLARITY_MAX_SIDE_PX,
    targetBytes: PROFILE_CLARITY_TARGET_BYTES,
    qualityStart: PROFILE_CLARITY_JPEG_QUALITY_START,
    qualityMin: PROFILE_CLARITY_JPEG_QUALITY_MIN,
    minSidePx: PROFILE_CLARITY_MIN_SIDE_PX,
  });
}

export function compressTransformationJpeg(input) {
  return compressClarityJpeg(input, {
    maxSidePx: TRANSFORM_CLARITY_MAX_SIDE_PX,
    targetBytes: TRANSFORM_CLARITY_TARGET_BYTES,
    qualityStart: TRANSFORM_CLARITY_JPEG_QUALITY_START,
    qualityMin: TRANSFORM_CLARITY_JPEG_QUALITY_MIN,
    minSidePx: TRANSFORM_CLARITY_MIN_SIDE_PX,
  });
}

function encodeAt(input, side, quality) {
  return sharp(input)
    .rotate()
    .resize({
      width: side,
      height: side,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .jpeg({ quality, mozjpeg: true })
    .toBuffer();
}
