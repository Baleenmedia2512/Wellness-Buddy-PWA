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
    case 'good-habit':
      return {
        src: `${base}/api/good-habits?id=${encodeURIComponent(id)}&userId=${encodeURIComponent(owner)}`,
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

/**
 * Resolve a share-card image src (data URL or http URL) from Thumb props.
 * @param {{ imageBase64?: string|null, imagePath?: string|null, imageUrl?: string|null, imageUrlFormat?: string|null }} thumb
 * @returns {Promise<string|null>}
 */
export async function fetchDiaryShareImageSrc(thumb) {
  if (!thumb) return null;
  if (thumb.imageBase64 && String(thumb.imageBase64).trim() !== '') {
    const raw = String(thumb.imageBase64);
    return raw.startsWith('data:image') ? raw : `data:image/jpeg;base64,${raw}`;
  }
  if (thumb.imageUrlFormat === 'raw' && thumb.imageUrl) {
    return thumb.imageUrl;
  }
  if (thumb.imagePath && (String(thumb.imagePath).startsWith('http') || String(thumb.imagePath).startsWith('data:'))) {
    return thumb.imagePath;
  }
  if (thumb.imageUrlFormat === 'json' && thumb.imageUrl) {
    try {
      const response = await fetch(thumb.imageUrl);
      if (!response.ok) return thumb.imagePath || null;
      const json = await response.json();
      const b64 = json?.image || json?.imageBase64 || json?.data?.imageBase64;
      if (!b64 || String(b64).trim() === '') return thumb.imagePath || null;
      const raw = String(b64);
      return raw.startsWith('data:image') ? raw : `data:image/jpeg;base64,${raw}`;
    } catch {
      return thumb.imagePath || null;
    }
  }
  return thumb.imagePath || null;
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
