/**
 * Unit tests for result-video upload size caps.
 * Run: node --test frontend/src/features/testimonials/__tests__/videoLimits.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_HEALTH_VIDEO_MB,
  MAX_BUSINESS_VIDEO_MB,
  isVideoOverSizeLimit,
  videoTooLargeMessage,
} from '../utils/videoLimits.js';

describe('video size limits', () => {
  it('caps each result video at 10 MB so Share Video stays small', () => {
    assert.equal(MAX_HEALTH_VIDEO_MB, 10);
    assert.equal(MAX_BUSINESS_VIDEO_MB, 10);
  });

  it('accepts a file at the limit', () => {
    const file = { size: 10 * 1024 * 1024 };
    assert.equal(isVideoOverSizeLimit(file, 'health'), false);
    assert.equal(isVideoOverSizeLimit(file, 'business'), false);
  });

  it('rejects a file over the limit', () => {
    const file = { size: 10 * 1024 * 1024 + 1 };
    assert.equal(isVideoOverSizeLimit(file, 'health'), true);
    assert.equal(videoTooLargeMessage('health'), 'Health video is too large (max 10 MB). Please compress or trim the video.');
  });
});
