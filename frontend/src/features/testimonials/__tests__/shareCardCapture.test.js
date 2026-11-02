/**
 * Run: node --test frontend/src/features/testimonials/__tests__/shareCardCapture.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  corsReloadUrl,
  isCanvasTaintError,
  isInlineCaptureSrc,
} from '../utils/shareCardCapture.js';

describe('share card capture taint recovery', () => {
  it('treats data and blob urls as already safe to draw', () => {
    assert.equal(isInlineCaptureSrc(''), true);
    assert.equal(isInlineCaptureSrc('data:image/jpeg;base64,abc'), true);
    assert.equal(isInlineCaptureSrc('blob:http://localhost/uuid'), true);
    assert.equal(isInlineCaptureSrc('https://cdn.example/a.jpg'), false);
  });

  it('recognises the canvas export SecurityError from Full Team share', () => {
    const err = new Error("Failed to execute 'toDataURL' on 'HTMLCanvasElement': Tainted canvases may not be exported.");
    err.name = 'SecurityError';
    assert.equal(isCanvasTaintError(err), true);
    assert.equal(isCanvasTaintError(new Error('network down')), false);
  });

  it('cache-busts remote photos and leaves inline srcs unchanged', () => {
    assert.equal(
      corsReloadUrl('https://cdn.example/a.jpg?token=abc'),
      'https://cdn.example/a.jpg?token=abc&wvcap=1',
    );
    assert.equal(corsReloadUrl('blob:http://localhost/x'), 'blob:http://localhost/x');
  });
});
