/**
 * useWeightDetailImage.js — slice-internal hook.
 *
 * Lazily fetches the full-size weight scale image on demand. The list
 * endpoint omits base64 for speed; the detail modal needs the real image.
 */
import { useEffect, useState } from 'react';

export function useWeightDetailImage({ apiBaseUrl, userId, entry } = {}) {
  const [lazyImage, setLazyImage] = useState(null);
  const [imageLoading, setImageLoading] = useState(false);

  useEffect(() => {
    if (!entry?.ID) return undefined;
    if (entry.WeightImageBase64) return undefined; // already provided
    if (!apiBaseUrl || !userId) return undefined;

    let cancelled = false;
    setLazyImage(null);
    setImageLoading(true);
    (async () => {
      try {
        const res = await fetch(
          `${apiBaseUrl}/api/weight/image?userId=${encodeURIComponent(userId)}&id=${encodeURIComponent(entry.ID)}`,
        );
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;
        if (json && json.success && json.image) setLazyImage(json.image);
      } catch {
        /* non-critical */
      } finally {
        if (!cancelled) setImageLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [apiBaseUrl, userId, entry?.ID, entry?.WeightImageBase64]);

  return { lazyImage, imageLoading };
}
