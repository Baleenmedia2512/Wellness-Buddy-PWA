/**
 * useEducationDetailImage.js — slice-internal hook.
 * Lazily fetches the full-size meeting screenshot. The list endpoint only
 * returns a thumbnail so the detail modal must hydrate the real image.
 * Uses the shared educationImageCache so list → detail does not re-fetch.
 */
import { useEffect, useState } from 'react';
import { resolveImageSrc } from '../services/educationFormatter';
import {
  fetchEducationLogImage,
  peekEducationLogImage,
} from '../services/educationImageCache';

export function useEducationDetailImage({ apiBaseUrl, userId, log } = {}) {
  const cached = log?.Id != null
    ? peekEducationLogImage(apiBaseUrl, userId, log.Id)
    : null;
  const [fullImage, setFullImage] = useState(cached);
  const [imageLoading, setImageLoading] = useState(false);

  useEffect(() => {
    const peeked = log?.Id != null
      ? peekEducationLogImage(apiBaseUrl, userId, log.Id)
      : null;
    setFullImage(peeked);
    if (!log?.hasFullImage || !apiBaseUrl || !userId || !log?.Id) return undefined;
    if (peeked) return undefined;

    let cancelled = false;
    const controller = new AbortController();
    setImageLoading(true);
    fetchEducationLogImage({
      apiBaseUrl,
      userId,
      logId: log.Id,
      signal: controller.signal,
    })
      .then((src) => {
        if (cancelled) return;
        if (src) setFullImage(src);
      })
      .catch(() => { /* fallback to thumbnail */ })
      .finally(() => { if (!cancelled) setImageLoading(false); });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [apiBaseUrl, userId, log?.Id, log?.hasFullImage]);

  const fallback = resolveImageSrc(log?.ImageBase64);
  return { imageSrc: fullImage || fallback, imageLoading };
}
