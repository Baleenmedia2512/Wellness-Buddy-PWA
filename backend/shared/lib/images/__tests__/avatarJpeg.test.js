/**
 * Run: node --test backend/shared/lib/images/__tests__/avatarJpeg.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {
  compressAvatarJpeg,
  AVATAR_TARGET_BYTES,
  AVATAR_MAX_SIDE_PX,
} from '../avatarJpeg.js';

async function noisyJpeg({ width, height, quality = 90 }) {
  const { data, info } = await sharp({
    create: {
      width,
      height,
      channels: 3,
      noise: { type: 'gaussian', mean: 128, sigma: 48 },
    },
  })
    .jpeg({ quality })
    .toBuffer({ resolveWithObject: true });
  assert.ok(info.size > AVATAR_TARGET_BYTES, 'fixture must start larger than the avatar budget');
  return data;
}

describe('compressAvatarJpeg', () => {
  it('shrinks a large photo to ≤22 KB and ≤256 px', async () => {
    const input = await noisyJpeg({ width: 1200, height: 900 });
    const { bytes, contentType } = await compressAvatarJpeg(input);
    assert.equal(contentType, 'image/jpeg');
    assert.ok(bytes.length <= AVATAR_TARGET_BYTES, `got ${bytes.length} bytes`);
    const meta = await sharp(bytes).metadata();
    assert.ok((meta.width || 0) <= AVATAR_MAX_SIDE_PX);
    assert.ok((meta.height || 0) <= AVATAR_MAX_SIDE_PX);
  });

  it('does not enlarge a small avatar', async () => {
    const input = await sharp({
      create: {
        width: 64,
        height: 48,
        channels: 3,
        background: { r: 40, g: 80, b: 120 },
      },
    })
      .jpeg({ quality: 80 })
      .toBuffer();
    const { bytes } = await compressAvatarJpeg(input);
    const meta = await sharp(bytes).metadata();
    assert.ok((meta.width || 0) <= 64);
    assert.ok((meta.height || 0) <= 48);
    assert.ok(bytes.length <= AVATAR_TARGET_BYTES);
  });

  it('rejects empty input', async () => {
    await assert.rejects(() => compressAvatarJpeg(Buffer.alloc(0)), /empty/i);
  });
});
