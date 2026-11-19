/**
 * In-memory localStorage for Node / Vercel.
 *
 * `ai-token-monitor` calls `localStorage.getItem` at import time
 * (`restoreSdk.js`). Node 25 can expose `globalThis.localStorage` as an
 * empty object when `--localstorage-file` has no path, so a
 * `typeof === 'undefined'` check is not enough. A throw here takes down
 * every API route that imports the SDK, including OPTIONS.
 *
 * Import this module BEFORE importing the SDK (see geminiClient.js).
 */

export function installServerLocalStorage() {
  if (storageWorks()) return;

  const store = new Map();
  const memoryStorage = {
    getItem(key) {
      const k = String(key);
      return store.has(k) ? store.get(k) : null;
    },
    setItem(key, value) {
      store.set(String(key), String(value));
    },
    removeItem(key) {
      store.delete(String(key));
    },
    clear() {
      store.clear();
    },
    key(index) {
      return [...store.keys()][index] ?? null;
    },
    get length() {
      return store.size;
    },
  };

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    enumerable: true,
    writable: true,
    value: memoryStorage,
  });
}

function storageWorks() {
  try {
    const storage = globalThis.localStorage;
    return Boolean(storage)
      && typeof storage.getItem === 'function'
      && typeof storage.setItem === 'function';
  } catch {
    return false;
  }
}

installServerLocalStorage();
