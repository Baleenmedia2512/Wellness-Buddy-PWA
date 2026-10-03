/**
 * Pending transformation photo merge — existing-user save safety.
 * Run: node --test frontend/src/features/user/domain/__tests__/transformationPhotosPending.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTransformationPhotoPayload,
  hasPendingTransformationUploads,
  isDataImageUrl,
  mergePreviewsPreservingPending,
} from '../transformationPhotosPending.js';

const DATA = 'data:image/jpeg;base64,abc';
const HTTPS = 'https://cdn.example.com/a.jpg';

describe('mergePreviewsPreservingPending', () => {
  it('keeps pending uploads over server slots', () => {
    const merged = mergePreviewsPreservingPending(
      { front: HTTPS, left: null, right: null },
      { front: null, left: DATA, right: null },
    );
    assert.equal(merged.left, DATA);
    assert.equal(merged.front, HTTPS);
    assert.equal(merged.right, null);
  });

  it('does not clear pending when stored is empty', () => {
    const pending = { front: DATA, left: DATA, right: DATA };
    const merged = mergePreviewsPreservingPending(null, pending);
    assert.deepEqual(merged, pending);
  });
});

describe('buildTransformationPhotoPayload', () => {
  it('sends only pending by default', () => {
    const payload = buildTransformationPhotoPayload(
      { front: null, left: DATA, right: null },
      { front: HTTPS, left: DATA, right: HTTPS },
    );
    assert.deepEqual(payload, { transformationPhotos: { left: DATA } });
  });

  it('can include filled data URLs from previews', () => {
    const payload = buildTransformationPhotoPayload(
      { front: null, left: null, right: null },
      { front: DATA, left: HTTPS, right: DATA },
      { includeFilledDataUrls: true },
    );
    assert.deepEqual(payload, {
      transformationPhotos: { front: DATA, right: DATA },
    });
  });
});

describe('helpers', () => {
  it('detects data image urls and pending uploads', () => {
    assert.equal(isDataImageUrl(DATA), true);
    assert.equal(isDataImageUrl(HTTPS), false);
    assert.equal(hasPendingTransformationUploads({ left: DATA }), true);
    assert.equal(hasPendingTransformationUploads({ left: HTTPS }), false);
  });
});
