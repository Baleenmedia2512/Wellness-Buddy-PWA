/**
 * Unit tests for result-video download helpers.
 * Run: node --test frontend/src/features/testimonials/__tests__/downloadVideo.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveResultVideoUrl } from '../utils/downloadVideo.js';

describe('resolveResultVideoUrl', () => {
  it('prefers the health result video', () => {
    assert.equal(
      resolveResultVideoUrl({
        healthVideoUrl: 'https://cdn.example/health.mp4',
        businessVideoUrl: 'https://cdn.example/business.mp4',
      }),
      'https://cdn.example/health.mp4',
    );
  });

  it('falls back to the business result video', () => {
    assert.equal(
      resolveResultVideoUrl({
        healthVideoUrl: null,
        businessVideoUrl: 'https://cdn.example/business.mp4',
      }),
      'https://cdn.example/business.mp4',
    );
  });

  it('returns null when no result video exists', () => {
    assert.equal(resolveResultVideoUrl({}), null);
    assert.equal(resolveResultVideoUrl(null), null);
  });
});
