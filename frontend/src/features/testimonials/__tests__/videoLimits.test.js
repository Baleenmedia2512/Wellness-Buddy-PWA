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
  it('caps each result video at 15 MB', () => {
    assert.equal(MAX_HEALTH_VIDEO_MB, 15);
    assert.equal(MAX_BUSINESS_VIDEO_MB, 15);
  });

  it('accepts a file at the limit', () => {
    const file = { size: 15 * 1024 * 1024 };
    assert.equal(isVideoOverSizeLimit(file, 'health'), false);
    assert.equal(isVideoOverSizeLimit(file, 'business'), false);
  });

  it('rejects 16 MB, 30 MB, and 40 MB files', () => {
    assert.equal(isVideoOverSizeLimit({ size: 16 * 1024 * 1024 }, 'health'), true);
    assert.equal(isVideoOverSizeLimit({ size: 30 * 1024 * 1024 }, 'business'), true);
    assert.equal(isVideoOverSizeLimit({ size: 40 * 1024 * 1024 }, 'health'), true);
    assert.equal(videoTooLargeMessage('health'), 'Upload max of 15 MB.');
    assert.equal(videoTooLargeMessage('business'), 'Upload max of 15 MB.');
  });
});
