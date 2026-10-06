/**
 * Server-composed Transformation share card for coach emails.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { composeTransformationShareCardJpeg } from '../domain/composeTransformationShareCard.js';

async function solidJpeg(width, height, color) {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: color,
    },
  })
    .jpeg()
    .toBuffer();
}

describe('composeTransformationShareCardJpeg', () => {
  it('builds a 540×960 JPEG from real Before/After photo bytes', async () => {
    const beforeBuffer = await solidJpeg(200, 300, { r: 200, g: 80, b: 80 });
    const afterBuffer = await solidJpeg(200, 300, { r: 80, g: 160, b: 80 });
    const jpeg = await composeTransformationShareCardJpeg({
      beforeBuffer,
      afterBuffer,
      memberName: 'Test Member',
      beforeWeightKg: 90.9,
      afterWeightKg: 60.8,
      goalType: 'loss',
      durationText: '6 months',
    });
    assert.ok(Buffer.isBuffer(jpeg));
    assert.ok(jpeg.length > 2000);
    const meta = await sharp(jpeg).metadata();
    assert.equal(meta.format, 'jpeg');
    assert.equal(meta.width, 540);
    assert.equal(meta.height, 960);
  });

  it('rejects missing photo buffers', async () => {
    await assert.rejects(
      () => composeTransformationShareCardJpeg({
        beforeBuffer: Buffer.from('x'),
        afterBuffer: null,
      }),
      /After photo required/,
    );
  });
});
