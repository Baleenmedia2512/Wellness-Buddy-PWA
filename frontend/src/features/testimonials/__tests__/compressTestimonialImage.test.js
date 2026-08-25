/**
 * Run: node --test frontend/src/features/testimonials/__tests__/compressTestimonialImage.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  browserHonoredExifOrientation,
  displaySizeAfterOrientation,
  isPortraitAfterOrientation,
  readJpegSize,
  resolveOrientedImageSize,
} from '../utils/compressTestimonialImage.js';

describe('displaySizeAfterOrientation', () => {
  it('swaps dimensions for EXIF 6 (iPhone portrait sensor)', () => {
    assert.deepEqual(displaySizeAfterOrientation(4032, 3024, 6), { width: 3024, height: 4032 });
  });

  it('keeps dimensions for EXIF 1', () => {
    assert.deepEqual(displaySizeAfterOrientation(3024, 4032, 1), { width: 3024, height: 4032 });
  });
});

describe('isPortraitAfterOrientation', () => {
  it('accepts Android raw landscape pixels with EXIF 6', () => {
    assert.equal(isPortraitAfterOrientation(4032, 3024, 6), true);
  });

  it('rejects true landscape EXIF 1', () => {
    assert.equal(isPortraitAfterOrientation(4032, 3024, 1), false);
  });
});

describe('browserHonoredExifOrientation', () => {
  it('detects iPhone Safari: encoded landscape + EXIF 6 + already-portrait Image', () => {
    assert.equal(browserHonoredExifOrientation(3024, 4032, 4032, 3024, 6), true);
  });

  it('does not flag Android WebView: Image still has encoded landscape pixels', () => {
    assert.equal(browserHonoredExifOrientation(4032, 3024, 4032, 3024, 6), false);
  });

  it('is false for EXIF 1 (no dimension swap)', () => {
    assert.equal(browserHonoredExifOrientation(3024, 4032, 3024, 4032, 1), false);
  });
});

describe('resolveOrientedImageSize — iPhone vs Android', () => {
  it('does not re-apply EXIF on iPhone, so a portrait photo stays portrait', () => {
    const resolved = resolveOrientedImageSize(3024, 4032, 4032, 3024, 6);
    assert.equal(resolved.applyExif, false);
    assert.equal(resolved.width, 3024);
    assert.equal(resolved.height, 4032);
    assert.ok(resolved.height > resolved.width);
  });

  it('applies EXIF on Android so landscape pixels become portrait', () => {
    const resolved = resolveOrientedImageSize(4032, 3024, 4032, 3024, 6);
    assert.equal(resolved.applyExif, true);
    assert.equal(resolved.width, 3024);
    assert.equal(resolved.height, 4032);
    assert.ok(resolved.height > resolved.width);
  });

  it('rejects a real landscape photo on both platforms', () => {
    const iphone = resolveOrientedImageSize(4032, 3024, 4032, 3024, 1);
    const android = resolveOrientedImageSize(4032, 3024, 4032, 3024, 1);
    assert.ok(iphone.height <= iphone.width);
    assert.ok(android.height <= android.width);
  });

  it('the old iPhone bug: applying EXIF twice would look like landscape', () => {
    const imgW = 3024;
    const imgH = 4032;
    const orientation = 6;
    assert.equal(isPortraitAfterOrientation(imgW, imgH, orientation), false);
    const resolved = resolveOrientedImageSize(imgW, imgH, 4032, 3024, orientation);
    assert.ok(resolved.height > resolved.width);
  });
});

describe('readJpegSize', () => {
  it('reads SOF0 width and height', () => {
    const jpeg = new Uint8Array([
      0xFF, 0xD8,
      0xFF, 0xC0, 0x00, 0x0B,
      0x08, 0x0F, 0xC0, 0x0B, 0xD0, 0x03, 0x01, 0x22, 0x00,
      0xFF, 0xDA, 0x00, 0x02,
    ]);
    assert.deepEqual(readJpegSize(jpeg.buffer), { width: 3024, height: 4032 });
  });

  it('returns null for non-JPEG', () => {
    assert.equal(readJpegSize(new Uint8Array([0x00, 0x00]).buffer), null);
  });
});
