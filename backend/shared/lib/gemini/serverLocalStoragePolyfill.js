/**
 * In-memory localStorage for Node / Vercel.
 *
 * `ai-token-monitor-sdk` calls `localStorage.getItem` at import time
 * (`restoreSdk.js`). That throws ReferenceError on the server and takes
 * down every API route that transitively imports geminiClient — including
 * OPTIONS and non-Gemini routes like /api/diary/list.
 *
 * Import this module BEFORE importing the SDK (see geminiClient.js).
 */
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map();
  globalThis.localStorage = {
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
}
