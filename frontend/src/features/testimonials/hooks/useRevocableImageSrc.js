import { useEffect, useState } from 'react';
import { jpegDataUrlToObjectUrl, revokeBlobUrl } from '../utils/testimonialMediaUrl.js';

/**
 * Keep <img src> on a live URL.
 * data: images become a blob: URL created in the effect (not useMemo) so React
 * Strict Mode cleanup does not revoke the src still painted on the page.
 * Existing blob:/https: URLs are passed through and not revoked here.
 *
 * @param {string|null|undefined} raw
 * @returns {string|null}
 */
export function useRevocableImageSrc(raw) {
  const isData = typeof raw === 'string' && raw.startsWith('data:image');
  const [src, setSrc] = useState(() => (isData || !raw ? null : raw));

  useEffect(() => {
    if (!raw) {
      setSrc(null);
      return undefined;
    }
    if (typeof raw === 'string' && raw.startsWith('data:image')) {
      const url = jpegDataUrlToObjectUrl(raw);
      setSrc(url);
      return () => revokeBlobUrl(url);
    }
    setSrc(raw);
    return undefined;
  }, [raw]);

  return src;
}
