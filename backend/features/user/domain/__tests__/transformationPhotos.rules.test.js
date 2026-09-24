/**
 * Run: node --test backend/features/user/domain/__tests__/transformationPhotos.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  TRANSFORMATION_PHOTOS_R2_MIN_APP_VERSION,
  finalizeTransformationPhotosOrphanSlots,
  hasTransformationPhotoUpdates,
  mapTransformationPhotos,
  mapTransformationPhotosForClient,
  mapTransformationPhotosRecord,
  mergeTransformationPhotos,
  shouldPreferTransformationR2Urls,
  slotsNeedingTransformationR2Upload,
} from '../transformationPhotos.rules.js';

const LEFT = 'data:image/jpeg;base64,leftbytes';
const FRONT = 'data:image/jpeg;base64,frontbytes';
const RIGHT = 'data:image/jpeg;base64,rightbytes';
const LEFT_KEY = 'transformation/1/left/abc123.jpg';

describe('shouldPreferTransformationR2Urls', () => {
  it('is false for missing / old versions (legacy base64)', () => {
    assert.equal(shouldPreferTransformationR2Urls({ appVersion: null }), false);
    assert.equal(shouldPreferTransformationR2Urls({ appVersion: '3.5.0' }), false);
    assert.equal(shouldPreferTransformationR2Urls({ appVersion: '3.4.9' }), false);
  });

  it('is true for 3.5.1+', () => {
    assert.equal(shouldPreferTransformationR2Urls({ appVersion: '3.5.1' }), true);
    assert.equal(shouldPreferTransformationR2Urls({ appVersion: '3.6.0' }), true);
    assert.equal(TRANSFORMATION_PHOTOS_R2_MIN_APP_VERSION, '3.5.1');
  });
});

describe('mapTransformationPhotosRecord', () => {
  it('reads slots and keys; ignores invalid keys', () => {
    const rec = mapTransformationPhotosRecord({
      left: LEFT,
      front: FRONT,
      right: RIGHT,
      leftKey: LEFT_KEY,
      frontKey: '../evil',
      rightKey: 'avatars/1/x.jpg',
    });
    assert.equal(rec.left, LEFT);
    assert.equal(rec.leftKey, LEFT_KEY);
    assert.equal(rec.frontKey, null);
    assert.equal(rec.rightKey, null);
  });

  it('mapTransformationPhotos hides keys', () => {
    assert.deepEqual(
      mapTransformationPhotos({ left: LEFT, leftKey: LEFT_KEY }),
      { front: null, left: LEFT, right: null },
    );
  });
});

describe('mapTransformationPhotosForClient', () => {
  it('legacy returns base64 even when key exists', () => {
    const out = mapTransformationPhotosForClient(
      { left: LEFT, leftKey: LEFT_KEY },
      { preferR2: false, resolveR2Url: (k) => `https://cdn/${k}` },
    );
    assert.equal(out.left, LEFT);
  });

  it('new clients prefer R2 URL from key', () => {
    const out = mapTransformationPhotosForClient(
      { left: LEFT, leftKey: LEFT_KEY, front: FRONT },
      { preferR2: true, resolveR2Url: (k) => `https://cdn/${k}` },
    );
    assert.equal(out.left, `https://cdn/${LEFT_KEY}`);
    assert.equal(out.front, FRONT);
  });
});

describe('mergeTransformationPhotos', () => {
  it('preserves keys when slot unchanged; clears key when slot replaced', () => {
    const existing = {
      left: LEFT,
      leftKey: LEFT_KEY,
      front: FRONT,
      frontKey: 'transformation/1/front/f.jpg',
    };
    const merged = mergeTransformationPhotos(existing, {
      left: LEFT,
      front: 'data:image/jpeg;base64,NEWfront',
    });
    assert.equal(merged.leftKey, LEFT_KEY);
    assert.equal(merged.front, 'data:image/jpeg;base64,NEWfront');
    assert.equal(merged.frontKey, null);
  });
});

describe('finalizeTransformationPhotosOrphanSlots', () => {
  it('keeps prior base64 slots and applies new keys only', () => {
    const existing = {
      left: LEFT,
      front: FRONT,
      leftKey: null,
      frontKey: null,
    };
    const withKeys = {
      left: 'data:image/jpeg;base64,NEWleft',
      front: 'data:image/jpeg;base64,NEWfront',
      leftKey: LEFT_KEY,
      frontKey: 'transformation/1/front/f.jpg',
    };
    const out = finalizeTransformationPhotosOrphanSlots(existing, withKeys);
    assert.equal(out.left, LEFT);
    assert.equal(out.front, FRONT);
    assert.equal(out.leftKey, LEFT_KEY);
    assert.equal(out.frontKey, 'transformation/1/front/f.jpg');
  });
});

describe('slotsNeedingTransformationR2Upload', () => {
  it('lists data URI slots without keys', () => {
    assert.deepEqual(
      slotsNeedingTransformationR2Upload({
        left: LEFT,
        leftKey: LEFT_KEY,
        front: FRONT,
        right: 'https://cdn.example/r.jpg',
      }),
      ['front'],
    );
  });
});

describe('hasTransformationPhotoUpdates', () => {
  it('detects slot payloads', () => {
    assert.equal(hasTransformationPhotoUpdates({ left: LEFT }), true);
    assert.equal(hasTransformationPhotoUpdates({ leftKey: LEFT_KEY }), false);
  });
});
