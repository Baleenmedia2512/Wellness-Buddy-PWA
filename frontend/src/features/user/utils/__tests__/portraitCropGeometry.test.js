/**
 * Run: node --test frontend/src/features/user/utils/__tests__/portraitCropGeometry.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  containRect,
  maxAspectCrop,
  clampAspectCrop,
  cropBoxToPixels,
  initialAspectCrop,
  resizeAspectCropFromCorner,
} from '../portraitCropGeometry.js';

describe('containRect', () => {
  it('letterboxes a landscape image in a tall viewport', () => {
    const r = containRect(100, 200, 200, 100);
    assert.equal(r.width, 100);
    assert.equal(r.height, 50);
    assert.equal(r.x, 0);
    assert.equal(r.y, 75);
  });
});

describe('initialAspectCrop', () => {
  it('starts inset so the box can grow or shrink', () => {
    const display = { x: 0, y: 0, width: 90, height: 160 };
    const crop = initialAspectCrop(display, 9 / 16, 0.85);
    assert.ok(crop.width < 90);
    assert.ok(crop.width > 40);
    assert.ok(Math.abs(crop.width / crop.height - 9 / 16) < 0.01);
  });
});

describe('clampAspectCrop', () => {
  it('refuses to collapse into a thin strip', () => {
    const display = { x: 0, y: 0, width: 180, height: 320 };
    const crop = clampAspectCrop({ x: 80, y: 0, width: 10, height: 320 }, display, 9 / 16);
    assert.ok(crop.width >= 180 * 0.25);
    assert.ok(Math.abs(crop.width / crop.height - 9 / 16) < 0.01);
  });
});

describe('cropBoxToPixels', () => {
  it('maps display crop to natural pixels', () => {
    const display = { x: 10, y: 20, width: 100, height: 200 };
    const pixels = cropBoxToPixels(
      { x: 10, y: 20, width: 50, height: 100 },
      display,
      400,
      800,
    );
    assert.deepEqual(pixels, { x: 0, y: 0, width: 200, height: 400 });
  });
});

describe('resizeAspectCropFromCorner', () => {
  it('keeps SW fixed when dragging the NE (top-right) corner', () => {
    const display = { x: 0, y: 0, width: 300, height: 400 };
    const start = { x: 60, y: 40, width: 90, height: 160 };
    const swBefore = { x: start.x, y: start.y + start.height };
    const next = resizeAspectCropFromCorner(start, 'ne', 120, 80, display, 9 / 16);
    assert.ok(Math.abs(next.width / next.height - 9 / 16) < 0.01);
    // SW stays put
    assert.ok(Math.abs(next.x - swBefore.x) < 1);
    assert.ok(Math.abs(next.y + next.height - swBefore.y) < 1);
  });

  it('grows from SE without collapsing width', () => {
    const display = { x: 0, y: 0, width: 300, height: 400 };
    const start = { x: 0, y: 0, width: 90, height: 160 };
    const next = resizeAspectCropFromCorner(start, 'se', 180, 320, display, 9 / 16);
    assert.ok(next.width > start.width);
    assert.ok(Math.abs(next.width / next.height - 9 / 16) < 0.01);
  });

  it('does not jump when pointer sits on the NE corner', () => {
    const display = { x: 0, y: 0, width: 300, height: 400 };
    const start = { x: 40, y: 50, width: 90, height: 160 };
    const next = resizeAspectCropFromCorner(
      start,
      'ne',
      start.x + start.width,
      start.y,
      display,
      9 / 16,
    );
    assert.ok(Math.abs(next.width - start.width) < 1);
    assert.ok(Math.abs(next.height - start.height) < 1);
  });
});

describe('maxAspectCrop', () => {
  it('fills height when display is wider than 9:16', () => {
    const display = { x: 10, y: 20, width: 180, height: 160 };
    const crop = maxAspectCrop(display, 9 / 16);
    assert.equal(crop.height, 160);
    assert.ok(Math.abs(crop.width - 90) < 0.01);
  });
});
