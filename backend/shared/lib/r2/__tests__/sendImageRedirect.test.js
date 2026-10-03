/**
 * Run: node --test backend/shared/lib/r2/__tests__/sendImageRedirect.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sendImageRedirect } from '../sendImageRedirect.js';

function mockRes() {
  const headers = {};
  return {
    headers,
    redirectStatus: null,
    redirectUrl: null,
    setHeader(k, v) { headers[k] = v; },
    redirect(status, url) {
      this.redirectStatus = status;
      this.redirectUrl = url;
    },
  };
}

describe('sendImageRedirect', () => {
  it('returns false without url', () => {
    const res = mockRes();
    assert.equal(sendImageRedirect(res, null), false);
    assert.equal(res.redirectStatus, null);
  });

  it('uses short Cache-Control for signed URLs', () => {
    const res = mockRes();
    const url = 'https://bucket.example/food/x.jpg?X-Amz-Signature=abc&X-Amz-Expires=3600';
    assert.equal(sendImageRedirect(res, url), true);
    assert.equal(res.redirectStatus, 302);
    assert.equal(res.redirectUrl, url);
    assert.equal(res.headers['Cache-Control'], 'private, max-age=300');
  });

  it('uses longer Cache-Control for stable public URLs', () => {
    const res = mockRes();
    const url = 'https://cdn.example/food/x.jpg';
    assert.equal(sendImageRedirect(res, url), true);
    assert.equal(res.headers['Cache-Control'], 'private, max-age=3600');
  });
});
