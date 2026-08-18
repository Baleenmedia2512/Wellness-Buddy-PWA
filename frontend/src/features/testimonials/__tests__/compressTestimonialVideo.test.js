/**
 * Run: node --test frontend/src/features/testimonials/__tests__/compressTestimonialVideo.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeTargetVideoBitrate,
  scaledVideoSize,
  compressVideoToMaxBytes,
  MIN_VIDEO_BITRATE,
  MAX_VIDEO_BITRATE,
} from '../utils/compressTestimonialVideo.js';

describe('computeTargetVideoBitrate', () => {
  it('targets about 15 MB for a 60s clip', () => {
    const bps = computeTargetVideoBitrate({
      durationSec: 60,
      maxBytes: 15 * 1024 * 1024,
    });
    assert.ok(bps >= MIN_VIDEO_BITRATE);
    assert.ok(bps <= MAX_VIDEO_BITRATE);
    assert.ok(bps > 1_000_000);
  });

  it('does not drop below the minimum bitrate for a very long clip', () => {
    const bps = computeTargetVideoBitrate({
      durationSec: 1800,
      maxBytes: 15 * 1024 * 1024,
    });
    assert.equal(bps, MIN_VIDEO_BITRATE);
  });
});

describe('scaledVideoSize', () => {
  it('keeps portrait 720p and even dimensions', () => {
    assert.deepEqual(scaledVideoSize(720, 1280), { width: 720, height: 1280 });
  });

  it('scales 1080p portrait down to 720p', () => {
    const size = scaledVideoSize(1080, 1920);
    assert.equal(size.width, 720);
    assert.equal(size.height, 1280);
  });
});

describe('compressVideoToMaxBytes', () => {
  it('returns the original file when it is already under the cap', async () => {
    const file = new File([new Uint8Array(1024)], 'clip.mp4', { type: 'video/mp4' });
    const result = await compressVideoToMaxBytes(file, 15 * 1024 * 1024);
    assert.equal(result, file);
  });
});
