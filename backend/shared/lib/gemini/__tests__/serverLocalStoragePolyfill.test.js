/**
 * Run: node --test backend/shared/lib/gemini/__tests__/serverLocalStoragePolyfill.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { installServerLocalStorage } from '../serverLocalStoragePolyfill.js';

describe('installServerLocalStorage', () => {
  it('replaces an empty Node localStorage that has no getItem', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      enumerable: true,
      writable: true,
      value: {},
    });

    installServerLocalStorage();

    assert.equal(typeof globalThis.localStorage.getItem, 'function');
    globalThis.localStorage.setItem('sdk-key', 'abc');
    assert.equal(globalThis.localStorage.getItem('sdk-key'), 'abc');
  });
});
