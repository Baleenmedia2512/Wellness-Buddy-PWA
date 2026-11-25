/**
 * Run: node --test backend/shared/lib/images/__tests__/clarityJpeg.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {
  compressProfileJpeg,
  compressTransformationJpeg,
  PROFILE_CLARITY_MAX_SIDE_PX,
  PROFILE_CLARITY_TARGET_BYTES,
  TRANSFORM_CLARITY_MAX_SIDE_PX,
  TRANSFORM_CLARITY_TARGET_BYTES,
} from '../clarityJpeg.js';
import { AVATAR_TARGET_BYTES } from '../avatarJpeg.js';

async function noisyJpeg({ width, height, quality = 92 }) {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      noise: { type: 'gaussian', mean: 128, sigma: 40 },
    },
  })
    .jpeg({ quality })
    .toBuffer();
}

describe('compressProfileJpeg', () => {
  it('keeps a larger budget than the 22 KB diary avatar thumb', async () => {
    const input = await noisyJpeg({ width: 1400, height: 1400 });
    const { bytes, contentType } = await compressProfileJpeg(input);
    assert.equal(contentType, 'image/jpeg');
    assert.ok(bytes.length <= PROFILE_CLARITY_TARGET_BYTES, `got ${bytes.length}`);
    assert.ok(bytes.length > AVATAR_TARGET_BYTES, 'profile should stay clearer than 22 KB thumbs');
    const meta = await sharp(bytes).metadata();
    assert.ok((meta.width || 0) <= PROFILE_CLARITY_MAX_SIDE_PX);
    assert.ok((meta.height || 0) <= PROFILE_CLARITY_MAX_SIDE_PX);
  });
});

describe('compressTransformationJpeg', () => {
  it('preserves more detail than profile for body photos', async () => {
    const input = await noisyJpeg({ width: 2400, height: 3200 });
    const { bytes, contentType } = await compressTransformationJpeg(input);
    assert.equal(contentType, 'image/jpeg');
    assert.ok(bytes.length <= TRANSFORM_CLARITY_TARGET_BYTES, `got ${bytes.length}`);
    const meta = await sharp(bytes).metadata();
    assert.ok((meta.width || 0) <= TRANSFORM_CLARITY_MAX_SIDE_PX);
    assert.ok((meta.height || 0) <= TRANSFORM_CLARITY_MAX_SIDE_PX);
    assert.ok(
      Math.max(meta.width || 0, meta.height || 0) >= 960,
      'transformation should not crush to avatar size',
    );
  });

  it('rejects empty input', async () => {
    await assert.rejects(() => compressTransformationJpeg(Buffer.alloc(0)), /empty/i);
  });
});
