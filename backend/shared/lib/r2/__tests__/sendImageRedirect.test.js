/**
 * Run: node --test backend/shared/lib/r2/__tests__/sendImageRedirect.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sendImageRedirect, sendStoredImage } from '../sendImageRedirect.js';

function mockRes() {
  const headers = {};
  return {
    headers,
    statusCode: null,
    body: null,
    redirectStatus: null,
    redirectUrl: null,
    setHeader(k, v) { headers[k] = v; },
    redirect(status, url) {
      this.redirectStatus = status;
      this.redirectUrl = url;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    send(body) {
      this.body = body;
      return this;
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

describe('sendStoredImage', () => {
  it('sends the database photo when the file URL is missing', () => {
    const res = mockRes();
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
    const image = `data:image/jpeg;base64,${jpeg.toString('base64')}`;
    assert.equal(sendStoredImage(res, { r2Url: null, image }), true);
    assert.equal(res.statusCode, 200);
    assert.equal(res.headers['Content-Type'], 'image/jpeg');
    assert.ok(Buffer.isBuffer(res.body));
    assert.equal(res.body.length, jpeg.length);
  });

  it('returns false when there is no file and no photo', () => {
    const res = mockRes();
    assert.equal(sendStoredImage(res, { r2Url: null, image: null }), false);
    assert.equal(res.statusCode, null);
  });
});
