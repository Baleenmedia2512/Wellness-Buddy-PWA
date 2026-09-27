/**
 * Avatar display version helpers — cache-bust /api/user/avatar after photo upload.
 * Run: node --test frontend/src/features/user/services/__tests__/avatarDisplayVersion.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildUserAvatarUrl,
  bumpAvatarDisplayVersion,
  getAvatarDisplayVersion,
  pickShareAvatarSrc,
  subscribeAvatarDisplayVersion,
} from '../avatarDisplayVersion.js';

describe('avatarDisplayVersion', () => {
  it('bumps generation and notifies subscribers', () => {
    const before = getAvatarDisplayVersion();
    const seen = [];
    const unsubscribe = subscribeAvatarDisplayVersion((v) => seen.push(v));
    const next = bumpAvatarDisplayVersion();
    assert.equal(next, before + 1);
    assert.equal(getAvatarDisplayVersion(), next);
    assert.deepEqual(seen, [next]);
    unsubscribe();
    bumpAvatarDisplayVersion();
    assert.deepEqual(seen, [next]);
  });

  it('buildUserAvatarUrl omits &_v when generation is 0', () => {
    assert.equal(
      buildUserAvatarUrl('https://api.example', 42, 0),
      'https://api.example/api/user/avatar?userId=42',
    );
  });

  it('buildUserAvatarUrl appends &_v when generation > 0', () => {
    assert.equal(
      buildUserAvatarUrl('https://api.example', '7', 3),
      'https://api.example/api/user/avatar?userId=7&_v=3',
    );
  });

  it('buildUserAvatarUrl appends inline=1 for crop fallback', () => {
    assert.equal(
      buildUserAvatarUrl('https://api.example', 42, 0, { inline: true }),
      'https://api.example/api/user/avatar?userId=42&inline=1',
    );
  });

  it('buildUserAvatarUrl returns null without base or userId', () => {
    assert.equal(buildUserAvatarUrl('', 1, 1), null);
    assert.equal(buildUserAvatarUrl('https://api.example', null, 1), null);
    assert.equal(buildUserAvatarUrl('https://api.example', '', 1), null);
  });

  it('pickShareAvatarSrc prefers data URIs over R2 https for canvas', () => {
    assert.equal(
      pickShareAvatarSrc({
        savedProfileImage: 'https://r2.example/a.jpg',
        sharePhotoBase64: 'data:image/jpeg;base64,abc',
        photoURL: 'https://lh3.googleusercontent.com/x',
      }),
      'data:image/jpeg;base64,abc',
    );
    assert.equal(
      pickShareAvatarSrc({
        savedProfileImage: 'data:image/jpeg;base64,legacy',
        sharePhotoBase64: 'data:image/jpeg;base64,google',
      }),
      'data:image/jpeg;base64,legacy',
    );
    assert.equal(
      pickShareAvatarSrc({
        savedProfileImage: 'https://r2.example/a.jpg',
        photoURL: 'https://fallback',
      }),
      'https://r2.example/a.jpg',
    );
  });
});
