/**
 * Run: node --test backend/features/user/domain/__tests__/profileDisplayAvatar.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveProfileDisplayAvatar } from '../profileDisplayAvatar.rules.js';

describe('resolveProfileDisplayAvatar', () => {
  it('prefers R2 key over https, transform, and base64', () => {
    const resolved = resolveProfileDisplayAvatar({
      profileImageKey: 'avatars/1.jpg',
      profileImage: 'https://lh3.googleusercontent.com/a/x',
      transformationPhotos: { front: 'data:image/jpeg;base64,FRONT' },
      r2Enabled: true,
      resolveR2Url: (key) => `https://cdn.example/${key}`,
    });
    assert.deepEqual(resolved, {
      kind: 'redirect',
      url: 'https://cdn.example/avatars/1.jpg',
    });
  });

  it('uses https ProfileImage when no R2 key', () => {
    const resolved = resolveProfileDisplayAvatar({
      profileImage: 'https://lh3.googleusercontent.com/a/x',
      transformationPhotos: { front: 'data:image/jpeg;base64,FRONT' },
    });
    assert.deepEqual(resolved, {
      kind: 'redirect',
      url: 'https://lh3.googleusercontent.com/a/x',
    });
  });

  it('falls back to centre transform before legacy base64 ProfileImage (My Profile parity)', () => {
    const resolved = resolveProfileDisplayAvatar({
      profileImage: 'data:image/jpeg;base64,SUIT',
      transformationPhotos: { front: 'data:image/jpeg;base64,RONALDO' },
    });
    assert.deepEqual(resolved, {
      kind: 'dataUri',
      value: 'data:image/jpeg;base64,RONALDO',
      persistAsProfileAvatar: false,
    });
  });

  it('uses https centre transform when present', () => {
    const resolved = resolveProfileDisplayAvatar({
      transformationPhotos: { front: 'https://cdn.example/front.jpg' },
    });
    assert.deepEqual(resolved, {
      kind: 'redirect',
      url: 'https://cdn.example/front.jpg',
    });
  });

  it('uses legacy base64 ProfileImage only when no centre transform', () => {
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
