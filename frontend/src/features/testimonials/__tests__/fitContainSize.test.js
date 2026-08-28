/**
 * Unit tests for share-card photo contain-fit (html2canvas / WhatsApp aspect).
 * Run: node --test frontend/src/features/testimonials/__tests__/fitContainSize.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fitContainSize } from '../utils/fitContainSize.js';

describe('fitContainSize', () => {
  it('keeps a 3:4 portrait inside a wider frame without stretching', () => {
    const box = fitContainSize(900, 1200, 152, 200);
    assert.equal(box.width, 150);
    assert.equal(box.height, 200);
    assert.equal(box.width / box.height, 900 / 1200);
  });

  it('keeps a landscape photo inside a tall frame without stretching', () => {
    const box = fitContainSize(1600, 900, 152, 200);
    assert.equal(box.width, 152);
    assert.equal(box.height, 86);
    assert.ok(Math.abs(box.width / box.height - 1600 / 900) < 0.02);
  });

  it('does not invent an aspect when natural size is missing', () => {
    const box = fitContainSize(0, 0, 152, 200);
    assert.deepEqual(box, { width: 152, height: 200 });
  });
});
