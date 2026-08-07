/**
 * Resolve lazy diary thumbnail sources (no Base64 in list payloads).
 */

import { getApiBaseUrl } from '../../../config/api.config';
import { resolveMealImageSrc } from '../../nutrition/services/nutritionDashboard/mealImageSrc';

/**
 * @param {{ kind: string, payload?: object, capture?: object }} entry
 * @param {{ ownerUserId?: string|number|null, viewerUserId?: string|number|null, apiBaseUrl?: string|null }} opts
 * @returns {{ src: string|null, format: 'data'|'raw'|'json'|null }}
 */
export function resolveDiaryThumbSource(entry, {
  ownerUserId = null,
  viewerUserId = null,
  apiBaseUrl = null,
} = {}) {
  if (!entry) return { src: null, format: null };
  const p = entry.payload || {};
  const base = apiBaseUrl || getApiBaseUrl();
  const owner = ownerUserId != null ? String(ownerUserId) : null;
  const viewer = viewerUserId != null ? String(viewerUserId) : owner;

  if (p.imageBase64 && String(p.imageBase64).trim() !== '') {
    const raw = String(p.imageBase64);
    return {
      src: raw.startsWith('data:image') ? raw : `data:image/jpeg;base64,${raw}`,
      format: 'data',
    };
  }

  if (p.imagePath && (String(p.imagePath).startsWith('http') || String(p.imagePath).startsWith('data:'))) {
    return { src: p.imagePath, format: 'raw' };
  }

  const id = p.id;
  if (id == null || !owner) {
    return { src: p.imagePath || null, format: p.imagePath ? 'raw' : null };
  }

  switch (entry.kind) {
    case 'food':
      return {
        src: resolveMealImageSrc(
          { id, ImagePath: p.imagePath },
          { userId: owner, apiBaseUrl: base },
        ),
        format: 'raw',
      };
    case 'weight':
      return {
        src: `${base}/api/weight/image?userId=${encodeURIComponent(owner)}&id=${encodeURIComponent(id)}`,
        format: 'json',
      };
    case 'education':
      return {
        src: `${base}/api/education/log-image?logId=${encodeURIComponent(id)}&userId=${encodeURIComponent(owner)}`,
        format: 'json',
      };
    case 'unknown':
      if (!viewer) return { src: null, format: null };
      return {
        src: `${base}/api/background-analysis/captures/image?captureId=${encodeURIComponent(id)}&viewerUserId=${encodeURIComponent(viewer)}`,
        format: 'raw',
      };
    default:
      return { src: p.imagePath || null, format: p.imagePath ? 'raw' : null };
  }
}

/** @deprecated use resolveDiaryThumbSource */
export function resolveDiaryThumbUrl(entry, opts) {
  return resolveDiaryThumbSource(entry, opts).src;
}
