/**
 * bcmShareCaptureCache.js — in-memory pre-capture for Save & Share.
 * Lets capture finish while the API runs; ShareSheet reuses by capture key.
 */
let cache = { key: '', dataUrl: null, promise: null };

export function setShareCapturePromise(key, promise) {
  cache = { key: key || '', dataUrl: null, promise: promise || null };
  if (promise) {
    promise.then((dataUrl) => {
      if (cache.key === key && dataUrl) {
        cache = { key, dataUrl, promise: null };
      }
    }).catch(() => {
      /* precaptureShareImage already fail-softs to null */
    });
  }
}

export function setShareCaptureResult(key, dataUrl) {
  cache = { key: key || '', dataUrl: dataUrl || null, promise: null };
}

/** @returns {Promise<string|null>} */
export async function getShareCaptureForKey(key) {
  if (!key) return null;
  if (cache.key === key && cache.dataUrl) return cache.dataUrl;
  if (cache.key === key && cache.promise) {
    const dataUrl = await cache.promise;
    return cache.key === key ? (dataUrl || cache.dataUrl || null) : null;
  }
  return null;
}

export function clearShareCaptureCache() {
  cache = { key: '', dataUrl: null, promise: null };
}
