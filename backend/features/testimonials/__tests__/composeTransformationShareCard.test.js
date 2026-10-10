/**
 * Server-composed Transformation share card for coach emails.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {
  composeTransformationShareCardJpeg,
  shareCardJpegHasReadableText,
} from '../domain/composeTransformationShareCard.js';

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
  it('builds a 540×960 JPEG with visible Before/After photos (not covered by overlay)', async () => {
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

    // Sample centre of Before slot (must not be white — overlay used to hide photos).
    const { data, info } = await sharp(jpeg)
      .extract({ left: 80, top: 200, width: 40, height: 40 })
      .raw()
      .toBuffer({ resolveWithObject: true });
    let redish = 0;
    for (let i = 0; i < data.length; i += info.channels) {
      if (data[i] > 150 && data[i + 1] < 120 && data[i + 2] < 120) redish += 1;
    }
    assert.ok(redish > 20, 'Before photo pixels should show through the overlay');

    // Name text must paint (embedded Noto Sans) — not empty tofu boxes.
    const nameBand = await sharp(jpeg)
      .extract({ left: 120, top: 70, width: 300, height: 30 })
      .raw()
      .toBuffer({ resolveWithObject: true });
    let darkText = 0;
    for (let i = 0; i < nameBand.data.length; i += nameBand.info.channels) {
      if (nameBand.data[i] < 40 && nameBand.data[i + 1] < 40 && nameBand.data[i + 2] < 40) {
        darkText += 1;
      }
    }
    assert.ok(darkText > 30, 'Member name text should render with embedded font');

    // Red DISCLAIMER border must be fully inside the 960px card (not clipped).
    const discBand = await sharp(jpeg)
      .extract({ left: 48, top: 850, width: 40, height: 12 })
      .raw()
      .toBuffer({ resolveWithObject: true });
    let redBorder = 0;
    for (let i = 0; i < discBand.data.length; i += discBand.info.channels) {
      if (discBand.data[i] > 160 && discBand.data[i + 1] < 100 && discBand.data[i + 2] < 100) {
        redBorder += 1;
      }
    }
    assert.ok(redBorder > 10, 'Disclaimer red border should be visible near the card bottom');
    assert.equal(await shareCardJpegHasReadableText(jpeg), true);
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
