/**
 * Run: node --test frontend/src/features/testimonials/__tests__/testimonialMediaUrl.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCapacitorHttpJson,
  withTestimonialMediaCacheBust,
  jpegDataUrlToObjectUrl,
} from '../utils/testimonialMediaUrl.js';

describe('withTestimonialMediaCacheBust', () => {
  it('appends cache-bust query param to signed URLs', () => {
    const url = 'https://cdn.example/before.jpg?token=abc';
    assert.equal(
      withTestimonialMediaCacheBust(url, '2026-08-17T10:00:00Z'),
      'https://cdn.example/before.jpg?token=abc&t=2026-08-17T10%3A00%3A00Z',
    );
  });

  it('leaves blob and data URLs unchanged', () => {
    assert.equal(withTestimonialMediaCacheBust('blob:http://local/x', 1), 'blob:http://local/x');
    assert.equal(withTestimonialMediaCacheBust('data:image/jpeg;base64,abc', 1), 'data:image/jpeg;base64,abc');
  });

  it('returns url unchanged when version is missing', () => {
    const url = 'https://cdn.example/after.jpg';
    assert.equal(withTestimonialMediaCacheBust(url, null), url);
  });
});

describe('parseCapacitorHttpJson', () => {
  it('parses JSON strings from native CapacitorHttp responses', () => {
    assert.deepEqual(parseCapacitorHttpJson('{"success":true}'), { success: true });
  });

  it('returns objects unchanged', () => {
    const obj = { success: true, path: '1/health_video_x.mp4' };
    assert.deepEqual(parseCapacitorHttpJson(obj), obj);
  });
});

describe('jpegDataUrlToObjectUrl', () => {
  it('leaves non-data URLs unchanged', () => {
    assert.equal(jpegDataUrlToObjectUrl('https://cdn.example/before.jpg'), 'https://cdn.example/before.jpg');
    assert.equal(jpegDataUrlToObjectUrl(''), '');
  });
});
