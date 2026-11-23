/**
 * Run: node --test frontend/src/features/user/domain/profileIntroFocus.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  clearProfileIntroFill,
  peekProfileIntroFill,
  profileIntroFieldDomId,
  profileIntroKeysFromLabels,
  requestProfileIntroFill,
} from './profileIntroFocus.js';

describe('profileIntroFocus', () => {
  it('maps publish labels to profile intro keys', () => {
    assert.deepEqual(
      profileIntroKeysFromLabels(['About me', 'Languages', 'Professional title']),
      ['aboutMe', 'languages', 'professionalTitle'],
    );
    assert.deepEqual(
      profileIntroKeysFromLabels(['Date of joining community', 'About me', 'About me']),
      ['herbalifeJoinedOn', 'aboutMe'],
    );
  });

  it('builds stable field dom ids', () => {
    assert.equal(profileIntroFieldDomId('aboutMe'), 'profile-intro-aboutMe');
  });

  it('peeks without clearing until clearProfileIntroFill', () => {
    const store = new Map();
    globalThis.sessionStorage = {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => { store.set(k, String(v)); },
      removeItem: (k) => { store.delete(k); },
    };
    requestProfileIntroFill(['aboutMe', 'languages']);
    assert.deepEqual(peekProfileIntroFill(), ['aboutMe', 'languages']);
    assert.deepEqual(peekProfileIntroFill(), ['aboutMe', 'languages']);
    clearProfileIntroFill();
    assert.deepEqual(peekProfileIntroFill(), []);
  });
});
