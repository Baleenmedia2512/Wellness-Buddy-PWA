/**
 * Resolve lazy diary thumbnail sources (no Base64 in list payloads).
 */

import { getApiBaseUrl } from '../../../config/api.config.js';
import { resolveMealImageSrc } from '../../nutrition/services/nutritionDashboard/mealImageSrc.js';
import { activityPhotoTemplate } from '../../../shared/assets/activityPhotoTemplates.js';
async function loadCapacitor() {
  try {
    return await import('@capacitor/core');
  } catch {
    return null;
  }
}

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

function blobToDataUrl(blob) {
  if (typeof FileReader === 'function') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Failed to read image'));
      reader.readAsDataURL(blob);
    });
  }
  return blob.arrayBuffer().then((buffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    const b64 = typeof Buffer !== 'undefined'
      ? Buffer.from(bytes).toString('base64')
      : btoa(binary);
    return `data:${blob.type || 'image/jpeg'};base64,${b64}`;
  });
}

function blobFromBase64(base64, mimeType) {
  const payload = String(base64 || '').includes(',')
    ? String(base64).split(',')[1]
    : String(base64 || '');
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType || 'image/jpeg' });
}

/**
 * Fetch a remote meal/weight/etc photo as a data URL so html2canvas can paint it.
 * API image routes 302 → R2; canvas capture fails on those redirects without this.
 *
 * @param {string} url
 * @param {{ fetchImpl?: typeof fetch, httpGet?: Function|null }} [opts]
 * @returns {Promise<string|null>}
 */
export async function fetchRemoteImageAsDataUrl(url, {
  fetchImpl = typeof fetch === 'function' ? fetch.bind(globalThis) : null,
  httpGet = null,
} = {}) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed || trimmed.startsWith('data:')) return trimmed.startsWith('data:image') ? trimmed : null;
  // Local templates / public assets — already same-origin for html2canvas.
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return trimmed;

  const toDataUrl = async (blob) => {
    if (!blob || !blob.size) return null;
    const type = String(blob.type || '');
    if (type && !type.startsWith('image/') && type !== 'application/octet-stream') {
      return null;
    }
    const dataUrl = await blobToDataUrl(blob);
    return dataUrl?.startsWith('data:') ? dataUrl : null;
  };

  const viaNativeHttp = async () => {
    let get = httpGet;
    if (!get) {
      const cap = await loadCapacitor();
      if (!cap?.CapacitorHttp?.get) return null;
      get = (args) => cap.CapacitorHttp.get(args);
    }
    const res = await get({ url: trimmed, responseType: 'blob' });
    if (res.status < 200 || res.status >= 300) return null;
    const mime = res.headers?.['content-type'] || res.headers?.['Content-Type'] || 'image/jpeg';
    const type = String(mime).split(';')[0].trim() || 'image/jpeg';
    if (typeof res.data === 'string') {
      return toDataUrl(blobFromBase64(res.data, type));
    }
    if (typeof Blob !== 'undefined' && res.data instanceof Blob) {
      return toDataUrl(res.data);
    }
    return null;
  };

  const cap = await loadCapacitor();
  const isNative = Boolean(cap?.Capacitor?.isNativePlatform?.());

  // Native: CapacitorHttp follows the API→R2 redirect without browser CORS.
  if (isNative || httpGet) {
    try {
      const dataUrl = await viaNativeHttp();
      if (dataUrl) return dataUrl;
    } catch {
      /* fall through to fetch */
    }
  }

  if (fetchImpl) {
    try {
      const res = await fetchImpl(trimmed, { mode: 'cors', credentials: 'omit' });
      if (res?.ok) {
        const dataUrl = await toDataUrl(await res.blob());
        if (dataUrl) return dataUrl;
      }
    } catch {
      /* fall through */
    }
  }

  // Web last resort: CapacitorHttp when available (still bypasses some CORS cases).
  if (!isNative && !httpGet) {
    try {
      const dataUrl = await viaNativeHttp();
      if (dataUrl) return dataUrl;
    } catch {
      /* ignore */
    }
  }

  return null;
}

/**
 * Share-card photo: prefer a paint-safe data URL. Older rows without ImageKey
 * use a local template.
 * @param {{ kind?: string, imageUrl?: string|null, imageUrlFormat?: string|null, imagePath?: string|null }} thumb
 * @param {{ fetchImpl?: typeof fetch, httpGet?: Function|null }} [opts]
 * @returns {Promise<string>}
 */
export async function fetchDiaryShareImageSrc(thumb, opts = {}) {
  const remote =
    (thumb?.imageUrlFormat === 'raw' && thumb.imageUrl)
    || (thumb?.imagePath && String(thumb.imagePath).startsWith('http') ? thumb.imagePath : null)
    || null;

  if (remote) {
    const dataUrl = await fetchRemoteImageAsDataUrl(remote, opts);
    if (dataUrl) return dataUrl;
  }

  return activityPhotoTemplate(thumb?.kind);
}

/**
 * Replace http(s) <img> srcs inside a share target with data URLs so
 * html2canvas does not drop API→R2 redirected photos.
 * @param {HTMLElement|null|undefined} element
 * @param {{ fetchImpl?: typeof fetch, httpGet?: Function|null }} [opts]
 */
export async function inlineDiaryShareImages(element, opts = {}) {
  if (!element || typeof element.querySelectorAll !== 'function') return;
  const imgs = Array.from(element.querySelectorAll('img'));
  await Promise.all(imgs.map(async (img) => {
    const src = img.currentSrc || img.getAttribute('src') || '';
    if (!src || src.startsWith('data:') || (src.startsWith('/') && !src.startsWith('//'))) {
      return;
    }
    if (!/^https?:\/\//i.test(src)) return;
    try {
      const dataUrl = await fetchRemoteImageAsDataUrl(src, opts);
      if (!dataUrl) return;
      img.removeAttribute('crossorigin');
      img.src = dataUrl;
      if (typeof img.decode === 'function') {
        try {
          await img.decode();
        } catch {
          await waitForShareImageDecode(dataUrl);
        }
      } else {
        await waitForShareImageDecode(dataUrl);
      }
    } catch {
      // keep original src — capture may still show a template onError
    }
  }));
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
