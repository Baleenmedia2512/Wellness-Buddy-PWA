/**
 * Run: node --test backend/shared/lib/images/__tests__/dataUri.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isHttpsImageUrl,
  isDataImageUri,
  parseDataUri,
  shouldStoreProfileImageInR2,
  extensionForContentType,
} from '../dataUri.js';

const JPEG_URI = 'data:image/jpeg;base64,/9j/4AAQ';

describe('isHttpsImageUrl', () => {
  it('accepts https Google-style URLs', () => {
    assert.equal(isHttpsImageUrl('https://lh3.googleusercontent.com/a/x'), true);
  });
  it('rejects data URIs and empty values', () => {
    assert.equal(isHttpsImageUrl(JPEG_URI), false);
    assert.equal(isHttpsImageUrl(''), false);
    assert.equal(isHttpsImageUrl(null), false);
  });
});

describe('parseDataUri', () => {
  it('decodes a jpeg data URI', () => {
    const parsed = parseDataUri(JPEG_URI);
    assert.equal(parsed.contentType, 'image/jpeg');
    assert.ok(Buffer.isBuffer(parsed.bytes));
    assert.ok(parsed.bytes.length > 0);
  });
  it('returns null for https URLs and junk', () => {
    assert.equal(parseDataUri('https://example.com/a.jpg'), null);
    assert.equal(parseDataUri('not-an-image'), null);
    assert.equal(parseDataUri(''), null);
  });
});

describe('shouldStoreProfileImageInR2', () => {
  it('stores custom data URIs only', () => {
    assert.equal(shouldStoreProfileImageInR2(JPEG_URI), true);
    assert.equal(shouldStoreProfileImageInR2('https://lh3.googleusercontent.com/a'), false);
    assert.equal(shouldStoreProfileImageInR2(null), false);
  });
});

describe('extensionForContentType', () => {
  it('maps common types', () => {
    assert.equal(extensionForContentType('image/png'), 'png');
    assert.equal(extensionForContentType('image/jpeg'), 'jpg');
    assert.equal(extensionForContentType('image/webp'), 'webp');
  });
});
