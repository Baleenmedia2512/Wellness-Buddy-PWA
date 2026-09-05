/**
 * Lazy weight scale photo. The image API 302s to R2 — use it as <img src>.
 */
import { useMemo } from 'react';

export function useWeightDetailImage({ apiBaseUrl, userId, entry } = {}) {
  const lazyImage = useMemo(() => {
    if (!entry?.ID || !apiBaseUrl || !userId) return null;
    return `${apiBaseUrl}/api/weight/image?userId=${encodeURIComponent(userId)}&id=${encodeURIComponent(entry.ID)}`;
  }, [apiBaseUrl, userId, entry?.ID]);

  return { lazyImage, imageLoading: false };
}
