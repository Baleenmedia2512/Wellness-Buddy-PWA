/**
 * Run: node --test frontend/src/features/user/domain/transformationPhotosGate.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  hasCompleteTransformationPhotos,
  resolveTransformationPhotosGate,
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
