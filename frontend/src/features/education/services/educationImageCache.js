/**
 * In-memory cache + in-flight dedup for GET /api/education/log-image.
 * Shared by EducationCard (list thumb) and useEducationDetailImage (modal)
 * so opening a card after the thumb loaded does not refetch.
 */

const cache = new Map();
const pending = new Map();

function cacheKey(apiBaseUrl, userId, logId) {
  return `${apiBaseUrl}|${userId}|${logId}`;
}

/**
 * @param {{ apiBaseUrl: string, userId: string|number, logId: string|number, signal?: AbortSignal }} opts
 * @returns {Promise<string|null>} data-URL or null
 */
export async function fetchEducationLogImage({ apiBaseUrl, userId, logId, signal } = {}) {
  if (!apiBaseUrl || userId == null || logId == null) return null;
  const key = cacheKey(apiBaseUrl, userId, logId);
  if (cache.has(key)) return cache.get(key);

  if (pending.has(key)) {
    return pending.get(key);
  }

  const promise = fetch(
    `${apiBaseUrl}/api/education/log-image?logId=${encodeURIComponent(logId)}&userId=${encodeURIComponent(userId)}`,
    { signal, cache: 'default' },
  )
    .then((r) => r.json())
    .then((res) => {
      if (!res?.success || !res.imageBase64) return null;
      const src = res.imageBase64.startsWith('data:')
        ? res.imageBase64
        : `data:image/jpeg;base64,${res.imageBase64}`;
      cache.set(key, src);
      return src;
    })
    .finally(() => {
      pending.delete(key);
    });

  pending.set(key, promise);
  return promise;
}

export function peekEducationLogImage(apiBaseUrl, userId, logId) {
  if (!apiBaseUrl || userId == null || logId == null) return null;
  return cache.get(cacheKey(apiBaseUrl, userId, logId)) || null;
}

export function clearEducationImageCache() {
  cache.clear();
  pending.clear();
}
