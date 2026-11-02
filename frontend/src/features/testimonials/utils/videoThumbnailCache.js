/**
 * In-memory cache for client-generated video thumbnails (data URLs).
 * Prevents re-downloading / re-decoding the same signed video URL.
 */

const cache = new Map();

export function getCachedVideoThumbnail(url) {
  if (!url) return null;
  return cache.get(url) || null;
}

export function setCachedVideoThumbnail(url, dataUrl) {
  if (!url || !dataUrl) return;
  cache.set(url, dataUrl);
}
