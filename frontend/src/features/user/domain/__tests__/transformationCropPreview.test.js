/**
 * Run: node --test frontend/src/features/user/domain/__tests__/transformationCropPreview.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { portraitCropWindowStyle } from '../transformationCropPreview.js';

describe('portraitCropWindowStyle', () => {
  it('maps the crop rectangle onto the window using the original pixel size', () => {
    const style = portraitCropWindowStyle(
      { x: 100, y: 50, width: 200, height: 400 },
      800,
      1000,
    );
    assert.equal(style.width, '400%');
    assert.equal(style.height, '250%');
    assert.equal(style.left, '-50%');
    assert.equal(style.top, '-12.5%');
    assert.equal(style.position, 'absolute');
    assert.equal(style.maxWidth, 'none');
  });

  it('returns null until both the crop and the image size are known', () => {
    assert.equal(portraitCropWindowStyle(null, 800, 1000), null);
    assert.equal(portraitCropWindowStyle({ x: 0, y: 0, width: 0, height: 10 }, 800, 1000), null);
    assert.equal(portraitCropWindowStyle({ x: 0, y: 0, width: 10, height: 10 }, 0, 1000), null);
  });
});
