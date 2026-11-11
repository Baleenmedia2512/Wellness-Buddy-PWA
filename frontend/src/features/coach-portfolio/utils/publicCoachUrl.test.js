/**
 * Run: node --test frontend/src/features/coach-portfolio/utils/publicCoachUrl.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolvePublicCoachUrl } from './publicCoachUrl.js';

describe('resolvePublicCoachUrl', () => {
  it('returns null for empty input', () => {
    assert.equal(resolvePublicCoachUrl(null), null);
    assert.equal(resolvePublicCoachUrl(''), null);
    assert.equal(resolvePublicCoachUrl('   '), null);
  });

  it('keeps absolute https URLs', () => {
    const url = 'https://test.wellnessvalley.in/coach/a/b/c';
    assert.equal(resolvePublicCoachUrl(url), url);
  });

  it('prefixes API base for relative coach paths', () => {
    const prev = process.env.REACT_APP_API_BASE_URL;
    process.env.REACT_APP_API_BASE_URL = 'https://test.wellnessvalley.in/';
    try {
      assert.equal(
        resolvePublicCoachUrl('/coach/chennai/adyar/priya'),
        'https://test.wellnessvalley.in/coach/chennai/adyar/priya',
      );
    } finally {
      if (prev == null) delete process.env.REACT_APP_API_BASE_URL;
      else process.env.REACT_APP_API_BASE_URL = prev;
    }
  });
});
