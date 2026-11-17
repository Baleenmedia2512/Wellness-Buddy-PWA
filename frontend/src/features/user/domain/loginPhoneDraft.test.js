/**
 * Run: node --test frontend/src/features/user/domain/loginPhoneDraft.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  LOGIN_PHONE_DRAFT_KEY,
  clearLoginPhoneDraft,
  loadLoginPhoneDraft,
  saveLoginPhoneDraft,
} from './loginPhoneDraft.js';

function memoryStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
  };
}

describe('loginPhoneDraft', () => {
  it('round-trips phone digits so Login remount keeps typed number', () => {
    const storage = memoryStorage();
    clearLoginPhoneDraft(storage);
    saveLoginPhoneDraft({
      email: '98765',
      countryDial: '+91',
      termsAccepted: true,
    }, storage);
    const loaded = loadLoginPhoneDraft(storage);
    assert.equal(loaded?.email, '98765');
    assert.equal(loaded?.termsAccepted, true);
    assert.equal(storage.getItem(LOGIN_PHONE_DRAFT_KEY) != null, true);
  });

  it('clears empty drafts so remount starts blank', () => {
    const storage = memoryStorage();
    saveLoginPhoneDraft({ email: '9', countryDial: '+91' }, storage);
    saveLoginPhoneDraft({ email: '', countryDial: '+91' }, storage);
    assert.equal(loadLoginPhoneDraft(storage), null);
  });
});
