/**
 * useEducationDetailImage.js — slice-internal hook.
 * Lazily fetches the full-size meeting screenshot. The list endpoint only
 * returns a thumbnail so the detail modal must hydrate the real image.
 */
import { useEffect, useState } from 'react';
import { resolveImageSrc } from '../services/educationFormatter';

export function useEducationDetailImage({ apiBaseUrl, userId, log } = {}) {
  const [fullImage, setFullImage] = useState(null);
  const [imageLoading, setImageLoading] = useState(false);

  useEffect(() => {
    setFullImage(null);
    if (!log?.hasFullImage || !apiBaseUrl || !userId || !log?.Id) return undefined;

    let cancelled = false;
    setImageLoading(true);
    fetch(`${apiBaseUrl}/api/education/log-image?logId=${log.Id}&userId=${userId}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.success && data.imageBase64) {
          setFullImage(resolveImageSrc(data.imageBase64));
        }
      })
      .catch(() => { /* fallback to thumbnail */ })
      .finally(() => { if (!cancelled) setImageLoading(false); });

    return () => { cancelled = true; };
  }, [apiBaseUrl, userId, log?.Id, log?.hasFullImage]);

  const fallback = resolveImageSrc(log?.ImageBase64);
  return { imageSrc: fullImage || fallback, imageLoading };
}
