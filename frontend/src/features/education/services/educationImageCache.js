/**
 * Education log photo URL. The API 302s to R2 — use as <img src>.
 */

function cacheKey(apiBaseUrl, userId, logId) {
  return `${apiBaseUrl}|${userId}|${logId}`;
}

function imageUrl(apiBaseUrl, userId, logId) {
  return `${apiBaseUrl}/api/education/log-image?logId=${encodeURIComponent(logId)}&userId=${encodeURIComponent(userId)}`;
}

const cache = new Map();

/**
 * @returns {Promise<string|null>} http(s) image URL
 */
export async function fetchEducationLogImage({ apiBaseUrl, userId, logId } = {}) {
  if (!apiBaseUrl || userId == null || logId == null) return null;
  const key = cacheKey(apiBaseUrl, userId, logId);
  if (cache.has(key)) return cache.get(key);
  const src = imageUrl(apiBaseUrl, userId, logId);
  cache.set(key, src);
  return src;
}

export function peekEducationLogImage(apiBaseUrl, userId, logId) {
  if (!apiBaseUrl || userId == null || logId == null) return null;
  return cache.get(cacheKey(apiBaseUrl, userId, logId)) || imageUrl(apiBaseUrl, userId, logId);
}
