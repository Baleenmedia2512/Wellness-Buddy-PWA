/**
 * Run: node --test frontend/src/features/testimonials/utils/testimonialMediaUrl.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveTestimonialMediaUrl,
  withTestimonialMediaCacheBust,
} from './testimonialMediaUrl.js';

describe('resolveTestimonialMediaUrl', () => {
  it('rewrites live file host onto the configured API base', () => {
    const url = 'https://wellnessvalley.in/api/testimonials/file?path=339%2Fbefore_1.jpg&exp=1&sig=abc';
    assert.equal(
      resolveTestimonialMediaUrl(url, 'https://test.wellnessvalley.in'),
      'https://test.wellnessvalley.in/api/testimonials/file?path=339%2Fbefore_1.jpg&exp=1&sig=abc',
    );
  });

  it('leaves profile / R2 https URLs alone', () => {
    const url = 'https://cdn.example/left.jpg';
    assert.equal(resolveTestimonialMediaUrl(url, 'https://test.wellnessvalley.in'), url);
  });

  it('prefixes relative file paths', () => {
    assert.equal(
      resolveTestimonialMediaUrl('/api/testimonials/file?path=1%2Fa.jpg', 'https://test.wellnessvalley.in'),
      'https://test.wellnessvalley.in/api/testimonials/file?path=1%2Fa.jpg',
    );
  });
});

describe('withTestimonialMediaCacheBust', () => {
  it('rewrites host then adds cache bust', () => {
    process.env.REACT_APP_API_BASE_URL = 'https://test.wellnessvalley.in';
    const url = 'https://wellnessvalley.in/api/testimonials/file?path=1%2Fa.jpg&exp=1&sig=x';
    const out = withTestimonialMediaCacheBust(url, '99');
    assert.match(out, /^https:\/\/test\.wellnessvalley\.in\/api\/testimonials\/file\?/);
    assert.match(out, /[?&]t=99/);
  });
});
