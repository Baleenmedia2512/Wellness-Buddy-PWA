/**
 * Resolve lazy diary thumbnail sources (no Base64 in list payloads).
 */

import { getApiBaseUrl } from '../../../config/api.config';
import { resolveMealImageSrc } from '../../nutrition/services/nutritionDashboard/mealImageSrc';
import { activityPhotoTemplate } from '../../../shared/assets/activityPhotoTemplates';

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

  if (p.imagePath && String(p.imagePath).startsWith('http')) {
    return { src: p.imagePath, format: 'raw' };
  }

  const id = p.id;
  if (id == null || !owner) {
    return { src: null, format: null };
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
        format: 'raw',
      };
    case 'education':
      return {
        src: `${base}/api/education/log-image?logId=${encodeURIComponent(id)}&userId=${encodeURIComponent(owner)}`,
        format: 'raw',
      };
    case 'good-habit':
      return {
        src: `${base}/api/good-habits?id=${encodeURIComponent(id)}&userId=${encodeURIComponent(owner)}&slot=main`,
        format: 'raw',
      };
    case 'unknown':
      if (!viewer) return { src: null, format: null };
      return {
        src: `${base}/api/background-analysis/captures/image?captureId=${encodeURIComponent(id)}&viewerUserId=${encodeURIComponent(viewer)}`,
        format: 'raw',
      };
    default:
      return { src: null, format: null };
  }
}

/** @deprecated use resolveDiaryThumbSource */
export function resolveDiaryThumbUrl(entry, opts) {
  return resolveDiaryThumbSource(entry, opts).src;
}

/**
 * Share-card photo: R2/API URL only. Older rows without ImageKey use a template.
 * @param {{ kind?: string, imageUrl?: string|null, imageUrlFormat?: string|null, imagePath?: string|null }} thumb
 * @returns {Promise<string>}
 */
export async function fetchDiaryShareImageSrc(thumb) {
  if (thumb?.imageUrlFormat === 'raw' && thumb.imageUrl) {
    return thumb.imageUrl;
  }
  if (thumb?.imagePath && String(thumb.imagePath).startsWith('http')) {
    return thumb.imagePath;
  }
  return activityPhotoTemplate(thumb?.kind);
}

/** Let html2canvas paint the share-card photo before capture. */
export function waitForShareImageDecode(src, timeoutMs = 5000) {
  if (!src) return Promise.resolve();
  return new Promise((resolve) => {
    const img = new Image();
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    const timer = setTimeout(done, timeoutMs);
    img.onload = () => { clearTimeout(timer); done(); };
    img.onerror = () => { clearTimeout(timer); done(); };
    img.src = src;
  });
}
