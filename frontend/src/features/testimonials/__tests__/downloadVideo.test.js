/**
 * Unit tests for result-video download helpers.
 * Run: node --test frontend/src/features/testimonials/__tests__/downloadVideo.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  listResultVideos,
  resolveResultVideoUrl,
  resultVideoExtension,
  resultVideoMime,
} from '../utils/downloadVideo.js';

describe('listResultVideos', () => {
  it('returns health and business videos when both exist', () => {
    const videos = listResultVideos({
      healthVideoUrl: 'https://cdn.example/health.mp4',
      businessVideoUrl: 'https://cdn.example/business.mp4',
    });
    assert.deepEqual(videos.map((v) => v.slot), ['health', 'business']);
    assert.equal(videos[0].url, 'https://cdn.example/health.mp4');
    assert.equal(videos[1].url, 'https://cdn.example/business.mp4');
  });

  it('omits missing slots', () => {
    const videos = listResultVideos({
      healthVideoUrl: null,
      businessVideoUrl: 'https://cdn.example/business.mp4',
    });
    assert.equal(videos.length, 1);
    assert.equal(videos[0].slot, 'business');
  });
});

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

describe('resultVideoExtension', () => {
  it('uses the video MIME when it is labelled correctly', () => {
    assert.equal(resultVideoExtension('video/mp4', 'https://cdn.example/file'), 'mp4');
    assert.equal(resultVideoExtension('video/webm', 'https://cdn.example/file'), 'webm');
    assert.equal(resultVideoExtension('video/quicktime', 'https://cdn.example/file'), 'mov');
  });

  it('never returns an image extension for a result video', () => {
    assert.equal(resultVideoExtension('image/jpeg', 'https://cdn.example/health.mp4'), 'mp4');
    assert.equal(resultVideoExtension('image/png', 'https://cdn.example/health.mp4'), 'mp4');
    assert.equal(resultVideoExtension('image/jpeg', 'https://cdn.example/file'), 'mp4');
  });

  it('reads mp4 from a signed URL when MIME is missing', () => {
    assert.equal(
      resultVideoExtension('', 'https://cdn.example/storage/health.mp4?token=abc'),
      'mp4',
    );
  });
});

describe('resultVideoMime', () => {
  it('keeps a real video MIME type', () => {
    assert.equal(resultVideoMime('video/mp4', 'mp4'), 'video/mp4');
    assert.equal(resultVideoMime('video/webm', 'webm'), 'video/webm');
  });

  it('forces video MIME when the CDN mislabels the file as an image', () => {
    assert.equal(resultVideoMime('image/jpeg', 'mp4'), 'video/mp4');
    assert.equal(resultVideoMime('application/octet-stream', 'mp4'), 'video/mp4');
    assert.equal(resultVideoMime('', 'webm'), 'video/webm');
  });
});
