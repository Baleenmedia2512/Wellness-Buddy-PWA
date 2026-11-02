/**
 * Run: node --test backend/features/user/domain/__tests__/profileDisplayAvatar.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveProfileDisplayAvatar } from '../profileDisplayAvatar.rules.js';

describe('resolveProfileDisplayAvatar', () => {
  it('prefers ProfileImageKey over Centre frontKey and Google', () => {
    const resolved = resolveProfileDisplayAvatar({
      profileImageKey: 'avatars/1.jpg',
      profileImage: 'https://lh3.googleusercontent.com/a/x',
      transformationPhotos: {
        front: 'data:image/jpeg;base64,FRONT',
        frontKey: 'transformation/1/front/abc.jpg',
      },
      r2Enabled: true,
      resolveR2Url: (key) => `https://cdn.example/${key}`,
    });
    assert.deepEqual(resolved, {
      kind: 'redirect',
      url: 'https://cdn.example/avatars/1.jpg',
    });
  });

  it('prefers https ProfileImage over Centre data URI', () => {
    const resolved = resolveProfileDisplayAvatar({
      profileImage: 'https://lh3.googleusercontent.com/a/x',
      transformationPhotos: { front: 'data:image/jpeg;base64,FRONT' },
    });
    assert.deepEqual(resolved, {
      kind: 'redirect',
      url: 'https://lh3.googleusercontent.com/a/x',
    });
  });

  it('uses ProfileImageKey when no Centre photo', () => {
    const resolved = resolveProfileDisplayAvatar({
      profileImageKey: 'avatars/1.jpg',
      profileImage: 'https://lh3.googleusercontent.com/a/x',
      transformationPhotos: { front: null, left: null, right: null },
      r2Enabled: true,
      resolveR2Url: (key) => `https://cdn.example/${key}`,
    });
    assert.deepEqual(resolved, {
      kind: 'redirect',
      url: 'https://cdn.example/avatars/1.jpg',
    });
  });

  it('uses https ProfileImage when no Centre and no R2 key', () => {
    const resolved = resolveProfileDisplayAvatar({
      profileImage: 'https://lh3.googleusercontent.com/a/x',
      transformationPhotos: { front: null, left: null, right: null },
    });
    assert.deepEqual(resolved, {
      kind: 'redirect',
      url: 'https://lh3.googleusercontent.com/a/x',
    });
  });

  it('falls back to centre transform R2 key when no profile image', () => {
    const resolved = resolveProfileDisplayAvatar({
      transformationPhotos: {
        front: 'data:image/jpeg;base64,FRONT',
        frontKey: 'transformation/1/front/abc.jpg',
      },
      r2Enabled: true,
      resolveR2Url: (key) => `https://cdn.example/${key}`,
    });
    assert.deepEqual(resolved, {
      kind: 'redirect',
      url: 'https://cdn.example/transformation/1/front/abc.jpg',
    });
  });

  it('prefers legacy base64 ProfileImage over centre transform (My Profile parity)', () => {
    const resolved = resolveProfileDisplayAvatar({
      profileImage: 'data:image/jpeg;base64,SUIT',
      transformationPhotos: { front: 'data:image/jpeg;base64,RONALDO' },
    });
    assert.deepEqual(resolved, {
      kind: 'dataUri',
      value: 'data:image/jpeg;base64,SUIT',
      persistAsProfileAvatar: true,
    });
  });

  it('uses https centre transform when no profile image', () => {
    const resolved = resolveProfileDisplayAvatar({
      transformationPhotos: { front: 'https://cdn.example/front.jpg' },
    });
    assert.deepEqual(resolved, {
      kind: 'redirect',
      url: 'https://cdn.example/front.jpg',
    });
  });

  it('uses Centre data URI when no profile image', () => {
    const resolved = resolveProfileDisplayAvatar({
      transformationPhotos: { front: 'data:image/jpeg;base64,FRONT' },
    });
    assert.deepEqual(resolved, {
      kind: 'dataUri',
      value: 'data:image/jpeg;base64,FRONT',
      persistAsProfileAvatar: false,
    });
  });

  it('uses legacy base64 ProfileImage only when no centre transform needed', () => {
    const resolved = resolveProfileDisplayAvatar({
      profileImage: 'data:image/jpeg;base64,SUIT',
      transformationPhotos: { front: null, left: null, right: null },
    });
    assert.deepEqual(resolved, {
      kind: 'dataUri',
      value: 'data:image/jpeg;base64,SUIT',
      persistAsProfileAvatar: true,
    });
  });

  it('returns none when nothing usable', () => {
    assert.deepEqual(resolveProfileDisplayAvatar({}), { kind: 'none' });
  });
});
