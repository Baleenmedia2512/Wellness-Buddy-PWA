/**
 * Avatar JPEG budget for R2. Keep in sync with frontend
 * PROFILE_IMAGE_TARGET_BYTES / PROFILE_IMAGE_MAX_DIMENSION_PX.
 */
import sharp from 'sharp';

export const AVATAR_MAX_SIDE_PX = 256;
export const AVATAR_TARGET_BYTES = 22 * 1024;
export const AVATAR_JPEG_QUALITY_START = 65;
export const AVATAR_JPEG_QUALITY_MIN = 20;
export const AVATAR_MIN_SIDE_PX = 64;

/**
 * Resize + JPEG-encode so the object is ≤ ~22 KB and ≤ 256 px on the long side.
 * Always returns image/jpeg (PNG/WebP avatars are flattened).
 *
 * @param {Buffer} input
 * @returns {Promise<{ bytes: Buffer, contentType: 'image/jpeg' }>}
 */
export async function compressAvatarJpeg(input) {
  if (!Buffer.isBuffer(input) || !input.length) {
    throw new Error('Avatar image is empty');
  }

  let quality = AVATAR_JPEG_QUALITY_START;
  let side = AVATAR_MAX_SIDE_PX;
  let bytes = await encodeAt(input, side, quality);

  while (bytes.length > AVATAR_TARGET_BYTES && quality > AVATAR_JPEG_QUALITY_MIN) {
    quality -= 5;
    bytes = await encodeAt(input, side, quality);
  }

  while (bytes.length > AVATAR_TARGET_BYTES && side > AVATAR_MIN_SIDE_PX) {
    side = Math.max(AVATAR_MIN_SIDE_PX, side - 32);
    bytes = await encodeAt(input, side, AVATAR_JPEG_QUALITY_MIN);
  }

  return { bytes, contentType: 'image/jpeg' };
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
