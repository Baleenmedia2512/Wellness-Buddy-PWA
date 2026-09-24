/**
 * Run: node --test frontend/src/features/user/utils/__tests__/freeQuadGeometry.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  containRect,
  initialQuad,
  moveCorner,
  moveEdge,
  midpoints,
  quadToNaturalPixels,
  quadOutputSize,
} from '../freeQuadGeometry.js';
import { perspectiveMatrix } from '../../services/warpQuadImage.js';

describe('initialQuad', () => {
  it('starts as an inset rectangle', () => {
    const display = { x: 0, y: 0, width: 100, height: 200 };
    const q = initialQuad(display, 0.1);
    assert.equal(q.tl.x, 10);
    assert.equal(q.tl.y, 20);
    assert.equal(q.br.x, 90);
    assert.equal(q.br.y, 180);
  });
});

describe('moveCorner', () => {
  it('moves only the top-right corner', () => {
    const display = { x: 0, y: 0, width: 200, height: 200 };
    const start = initialQuad(display, 0);
    const next = moveCorner(start, 'tr', { x: 150, y: 40 }, display);
    assert.deepEqual(next.tl, start.tl);
    assert.deepEqual(next.bl, start.bl);
    assert.deepEqual(next.br, start.br);
    assert.deepEqual(next.tr, { x: 150, y: 40 });
  });
});

describe('moveEdge', () => {
  it('moves both corners of the top edge together', () => {
    const display = { x: 0, y: 0, width: 200, height: 200 };
    const start = {
      tl: { x: 20, y: 20 },
      tr: { x: 180, y: 20 },
      br: { x: 180, y: 180 },
      bl: { x: 20, y: 180 },
    };
    const next = moveEdge(start, 'top', 0, 30, display);
    assert.equal(next.tl.y, 50);
    assert.equal(next.tr.y, 50);
    assert.deepEqual(next.bl, start.bl);
    assert.deepEqual(next.br, start.br);
  });
});

describe('midpoints', () => {
  it('returns edge centers', () => {
    const q = {
      tl: { x: 0, y: 0 },
      tr: { x: 100, y: 0 },
      br: { x: 100, y: 100 },
      bl: { x: 0, y: 100 },
    };
    assert.deepEqual(midpoints(q).top, { x: 50, y: 0 });
    assert.deepEqual(midpoints(q).right, { x: 100, y: 50 });
  });
});

describe('quadToNaturalPixels', () => {
  it('maps display coords to natural pixels', () => {
    const display = { x: 10, y: 20, width: 100, height: 200 };
    const q = {
      tl: { x: 10, y: 20 },
      tr: { x: 110, y: 20 },
      br: { x: 110, y: 220 },
      bl: { x: 10, y: 220 },
    };
    const natural = quadToNaturalPixels(q, display, 400, 800);
    assert.deepEqual(natural.tl, { x: 0, y: 0 });
    assert.deepEqual(natural.br, { x: 400, y: 800 });
  });
});

describe('quadOutputSize', () => {
  it('averages opposite sides and caps the long side', () => {
    const natural = {
      tl: { x: 0, y: 0 },
      tr: { x: 900, y: 0 },
      br: { x: 900, y: 1600 },
      bl: { x: 0, y: 1600 },
    };
    const size = quadOutputSize(natural, 1200);
    assert.equal(size.width, 675);
    assert.equal(size.height, 1200);
  });
});

describe('axisAlignedBounds', () => {
  it('returns the bounding box of a free quad', async () => {
    const { axisAlignedBounds, clampPixelCrop } = await import('../../services/warpQuadImage.js');
    const box = axisAlignedBounds({
      tl: { x: 10, y: 20 },
      tr: { x: 110, y: 25 },
      br: { x: 100, y: 200 },
      bl: { x: 5, y: 190 },
    });
    assert.equal(box.x, 5);
    assert.equal(box.y, 20);
    assert.equal(box.width, 105);
    assert.equal(box.height, 180);

    const clamped = clampPixelCrop({ x: -5, y: 10, width: 500, height: 500 }, 200, 100);
    assert.equal(clamped.x, 0);
    assert.equal(clamped.y, 10);
    assert.equal(clamped.width, 200);
    assert.equal(clamped.height, 90);
  });
});

describe('perspectiveMatrix', () => {
  it('maps a rectangle dest back to a rectangle source identity-ish', () => {
    const src = {
      tl: { x: 0, y: 0 },
      tr: { x: 100, y: 0 },
      br: { x: 100, y: 200 },
      bl: { x: 0, y: 200 },
    };
    const H = perspectiveMatrix(src, 100, 200);
    // Top-left dest (0,0) → src (~0,0)
    const w = H[6] * 0 + H[7] * 0 + H[8];
    const x = (H[0] * 0 + H[1] * 0 + H[2]) / w;
    const y = (H[3] * 0 + H[4] * 0 + H[5]) / w;
    assert.ok(Math.abs(x) < 0.01);
    assert.ok(Math.abs(y) < 0.01);
  });
});

describe('containRect', () => {
  it('letterboxes landscape into tall viewport', () => {
    const r = containRect(100, 200, 200, 100);
    assert.equal(r.width, 100);
    assert.equal(r.height, 50);
  });
});
