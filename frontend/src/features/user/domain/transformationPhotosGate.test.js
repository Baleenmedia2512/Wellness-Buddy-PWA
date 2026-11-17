/**
 * Run: node --test frontend/src/features/user/domain/transformationPhotosGate.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  hasCompleteTransformationPhotos,
  readTransformationPhotosComplete,
  rememberTransformationPhotosComplete,
  resolveTransformationPhotosGate,
  shouldSuppressPhotosStep,
} from './transformationPhotosGate.js';

describe('hasCompleteTransformationPhotos', () => {
  it('requires left, centre (front), and right', () => {
    assert.equal(hasCompleteTransformationPhotos(null), false);
    assert.equal(hasCompleteTransformationPhotos({ left: 'a', front: 'b' }), false);
    assert.equal(
      hasCompleteTransformationPhotos({ left: 'a', front: 'b', right: 'c' }),
      true,
    );
  });
});

describe('resolveTransformationPhotosGate', () => {
  it('hides when this session already confirmed the photos', () => {
    assert.equal(
      resolveTransformationPhotosGate({
        confirmedThisSession: true,
        profile: { transformationPhotos: {} },
        fetchFailed: true,
      }),
      'hide',
    );
  });

  it('keeps current screen when the profile fetch fails', () => {
    assert.equal(resolveTransformationPhotosGate({ fetchFailed: true }), 'keep');
  });

  it('shows for existing users missing any slot', () => {
    assert.equal(
      resolveTransformationPhotosGate({
        profile: { transformationPhotos: { left: 'x', front: 'y' } },
      }),
      'show',
    );
    assert.equal(
      resolveTransformationPhotosGate({
        profile: { transformationPhotos: { left: null, front: null, right: null } },
      }),
      'show',
    );
  });

  it('hides when all three slots are filled', () => {
    assert.equal(
      resolveTransformationPhotosGate({
        profile: {
          transformationPhotos: { left: 'L', front: 'C', right: 'R' },
        },
      }),
      'hide',
    );
  });

  it('hides when profile payload is missing (do not fail-closed)', () => {
    assert.equal(resolveTransformationPhotosGate({ profile: null }), 'hide');
  });
});

describe('saved transformation photos', () => {
  it('keeps the photo gate off after an app restart when all three were saved', () => {
    const map = new Map();
    const storage = {
      getItem: (key) => (map.has(key) ? map.get(key) : null),
      setItem: (key, value) => map.set(key, String(value)),
    };
    assert.equal(readTransformationPhotosComplete(7, storage), false);
    assert.equal(shouldSuppressPhotosStep('photos', false), false);
    rememberTransformationPhotosComplete(7, storage);
    assert.equal(readTransformationPhotosComplete(7, storage), true);
    assert.equal(shouldSuppressPhotosStep('photos', true), true);
    assert.equal(shouldSuppressPhotosStep('communityPosition', true), false);
  });
});
