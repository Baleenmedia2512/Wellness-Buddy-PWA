/**
 * downloadVideo.js — download/share the actual result-video files (not a screenshot).
 *
 * Share must never send Health/Business videos as photos. WhatsApp treats a
 * mixed image+video share as an album of stills, so native Share sends videos
 * first (video/mp4) and the transformation card image in a second sheet.
 */
import { Capacitor } from '@capacitor/core';
import { debugLog } from '../../../shared/utils/logger.js';

const VIDEO_EXTS = ['mp4', 'mov', 'webm', 'm4v', '3gp'];

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read video data'));
    reader.readAsDataURL(blob);
  });
}

function extensionFromUrl(url) {
  const fromUrl = String(url || '').split('?')[0].split('.').pop();
  if (fromUrl && /^[a-z0-9]{2,5}$/i.test(fromUrl)) return fromUrl.toLowerCase();
  return '';
}

/**
 * File extension for a result-video file. Never returns an image extension —
 * even if the CDN mislabels Content-Type as image/jpeg.
 * @param {string} [mimeType]
 * @param {string} [fallbackUrl]
 * @returns {string}
 */
export function resultVideoExtension(mimeType, fallbackUrl) {
  const mime = String(mimeType || '').toLowerCase();
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('quicktime') || mime.includes('mov')) return 'mov';
  if (mime.includes('m4v')) return 'm4v';
  if (mime.includes('3gpp') || mime.includes('3gp')) return '3gp';
  if (mime.includes('mp4') || mime.includes('mpeg') || mime.startsWith('video/')) return 'mp4';
  const fromUrl = extensionFromUrl(fallbackUrl);
  if (VIDEO_EXTS.includes(fromUrl)) return fromUrl;
  return 'mp4';
}

/**
 * MIME type WhatsApp / the share sheet must see for a result video.
 * @param {string} [mimeType]
 * @param {string} [ext]
 * @returns {string}
 */
export function resultVideoMime(mimeType, ext = 'mp4') {
  const mime = String(mimeType || '').toLowerCase();
  if (mime.startsWith('video/')) return mimeType;
  if (ext === 'webm') return 'video/webm';
  if (ext === 'mov') return 'video/quicktime';
  if (ext === '3gp') return 'video/3gpp';
  return 'video/mp4';
}

function safeFileBase(name, fallback = 'transformation-result') {
  return String(name || fallback)
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase();
}

function downloadBlobWeb(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Large videos need the object URL to stay alive until the browser starts the download.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

async function downloadFilesWeb(files) {
  for (const file of files) {
    downloadBlobWeb(file.blob, file.filename);
    await delay(300);
  }
}

function isShareCanceled(err) {
  const msg = String(err?.message || err || '').toLowerCase();
  return msg.includes('cancel') || msg.includes('dismiss') || msg.includes('abort');
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function blobFromBase64(base64, mimeType) {
  const payload = String(base64 || '').includes(',')
    ? String(base64).split(',')[1]
    : String(base64 || '');
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType || 'video/mp4' });
}

async function fetchBlobViaNativeHttp(url) {
  const { CapacitorHttp } = await import('@capacitor/core');
  const res = await CapacitorHttp.get({ url, responseType: 'blob' });
  if (res.status < 200 || res.status >= 300) {
    throw new Error('Could not download the result video');
  }
  const mime = res.headers?.['content-type'] || res.headers?.['Content-Type'] || 'video/mp4';
  const type = String(mime).split(';')[0].trim() || 'video/mp4';
  if (typeof res.data === 'string') return blobFromBase64(res.data, type);
  if (res.data instanceof Blob) return res.data;
  throw new Error('Could not download the result video');
}

async function fetchBlob(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Could not download the result video');
    }
    const blob = await response.blob();
    if (!blob || blob.size === 0) {
      throw new Error('The result video file was empty');
    }
    return blob;
  } catch (err) {
    if (!Capacitor.isNativePlatform()) throw err;
    debugLog('[testimonials] fetch video failed, retrying native HTTP', err?.message);
    return fetchBlobViaNativeHttp(url);
  }
}

function resultVideoFile(blob, url, label, baseName = 'transformation') {
  const ext = resultVideoExtension(blob.type, url);
  return {
    blob,
    filename: `${safeFileBase(baseName)}-${label}.${ext}`,
    mime: resultVideoMime(blob.type, ext),
  };
}

/**
 * Health + business result videos that have a playable/signed URL.
 * @param {{ healthVideoUrl?: string|null, businessVideoUrl?: string|null }} testimonial
 * @returns {Array<{ slot: 'health'|'business', label: string, url: string }>}
 */
export function listResultVideos(testimonial) {
  const videos = [];
  if (testimonial?.healthVideoUrl) {
    videos.push({ slot: 'health', label: 'health', url: testimonial.healthVideoUrl });
  }
  if (testimonial?.businessVideoUrl) {
    videos.push({ slot: 'business', label: 'business', url: testimonial.businessVideoUrl });
  }
  return videos;
}

/**
 * Prefer the health result video, then the business result video.
 * @param {{ healthVideoUrl?: string|null, businessVideoUrl?: string|null }} testimonial
 */
export function resolveResultVideoUrl(testimonial) {
  return listResultVideos(testimonial)[0]?.url || null;
}

function isVideoShareFile(file) {
  const mime = String(file?.mime || '').toLowerCase();
  const name = String(file?.filename || '').toLowerCase();
  return mime.startsWith('video/') || /\.(mp4|mov|webm|m4v|3gp)$/.test(name);
}

async function writeAndShareNative(files, { title, text } = {}) {
  const { Filesystem, Directory } = await import('@capacitor/filesystem');
  const { Share } = await import('@capacitor/share');
  const uris = [];
  for (const file of files) {
    const dataUrl = await blobToBase64(file.blob);
    const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
    const saved = await Filesystem.writeFile({
      path: file.filename,
      data: base64,
      directory: Directory.Cache,
    });
    uris.push(saved.uri);
  }
  // WhatsApp drops video files when EXTRA_TEXT is set — send files only.
  const sharingVideo = files.some(isVideoShareFile);
  const caption = String(text || '').trim();
  const payload = {
    title,
    files: uris,
    dialogTitle: title,
  };
  if (caption && !sharingVideo) {
    payload.text = caption;
  }
  await Share.share(payload);
}

const nativeVideoUriCache = new Map();

async function getShareableUri(filename) {
  const { Filesystem, Directory } = await import('@capacitor/filesystem');
  const { uri } = await Filesystem.getUri({
    path: filename,
    directory: Directory.Cache,
  });
  return uri;
}

/**
 * Native download straight to cache — skips JS blob/base64 (the 16–20s cost).
 * @param {object|null} testimonial
 */
export async function prefetchNativeResultVideos(testimonial) {
  if (!Capacitor.isNativePlatform()) return;
  const videos = listResultVideos(testimonial);
  if (videos.length === 0) return;

  const { Filesystem, Directory } = await import('@capacitor/filesystem');
  await Promise.all(videos.map(async (video) => {
    if (nativeVideoUriCache.has(video.url)) return;
    const ext = resultVideoExtension('', video.url);
    const filename = `wv-share-${video.label}.${ext}`;
    try {
      if (typeof Filesystem.downloadFile === 'function') {
        await Filesystem.downloadFile({
          url: video.url,
          path: filename,
          directory: Directory.Cache,
        });
        nativeVideoUriCache.set(video.url, await getShareableUri(filename));
        return;
      }
    } catch (err) {
      debugLog('[testimonials] native video downloadFile failed', video.slot, err?.message);
    }
  }));
}

async function shareNativeCachedVideos(testimonial) {
  const videos = listResultVideos(testimonial);
  const uris = videos.map((video) => nativeVideoUriCache.get(video.url)).filter(Boolean);
  if (uris.length === 0) return false;
  const { Share } = await import('@capacitor/share');
  await Share.share({
    title: 'Transformation Result Videos',
    files: uris,
    dialogTitle: 'Transformation Result Videos',
  });
  return true;
}

async function shareNativeVideoFiles(videoFiles) {
  if (videoFiles.length === 0) return;
  await writeAndShareNative(videoFiles, {
    title: 'Transformation Result Videos',
  });
}

function toWebFiles(files) {
  return files.map((file) => new File(
    [file.blob],
    file.filename,
    { type: file.mime || 'application/octet-stream' },
  ));
}

/**
 * @returns {'shared'|'canceled'|'unsupported'}
 */
async function shareFilesWeb(files, { title, text } = {}) {
  if (files.length === 0) return 'unsupported';
  try {
    const nativeFiles = toWebFiles(files);
    const canShareFiles = typeof navigator.canShare === 'function'
      && navigator.canShare({ files: nativeFiles });
    if (!canShareFiles || typeof navigator.share !== 'function') return 'unsupported';
    const sharingVideo = files.some(isVideoShareFile);
    const payload = { title, files: nativeFiles };
    const caption = String(text || '').trim();
    if (caption && !sharingVideo) payload.text = caption;
    await navigator.share(payload);
    return 'shared';
  } catch (err) {
    if (isShareCanceled(err) || err?.name === 'AbortError') return 'canceled';
    debugLog('[testimonials] web share not available', err?.message);
    return 'unsupported';
  }
}

async function fetchResultVideoFiles(testimonial, baseName = 'transformation', { openOnFail = false } = {}) {
  const videos = listResultVideos(testimonial);
  const results = await Promise.all(videos.map(async (video) => {
    try {
      const blob = await fetchBlob(video.url);
      return resultVideoFile(blob, video.url, video.label, baseName);
    } catch (err) {
      debugLog('[testimonials] result video fetch failed', video.slot, err?.message);
      if (openOnFail && typeof window !== 'undefined') {
        window.open(video.url, '_blank', 'noopener,noreferrer');
      }
      return null;
    }
  }));
  return results.filter(Boolean);
}

/**
 * Start fetching Health/Business videos in the background (both at once).
 * Used so the card share sheet can open without waiting for the downloads.
 * @param {object|null} testimonial
 * @param {string} [baseName]
 */
export function prefetchResultVideos(testimonial, baseName = 'transformation') {
  return fetchResultVideoFiles(testimonial, baseName, { openOnFail: false });
}

async function collectResultVideoFiles(testimonial, baseName = 'transformation') {
  return fetchResultVideoFiles(testimonial, baseName, { openOnFail: true });
}

/**
 * Fetch the video at `url` and save/share the real media file.
 * @param {string} url
 * @param {string} [baseName]
 */
export async function downloadVideoFromUrl(url, baseName = 'transformation-result') {
  if (!url) throw new Error('No result video is available to download');
  try {
    const blob = await fetchBlob(url);
    const ext = resultVideoExtension(blob.type, url);
    const filename = `${safeFileBase(baseName)}.${ext}`;
    if (!Capacitor.isNativePlatform()) {
      downloadBlobWeb(blob, filename);
      return;
    }
  await writeAndShareNative(
      [{ blob, filename, mime: resultVideoMime(blob.type, ext) }],
      { title: 'Transformation Result Video' },
    );
  } catch (err) {
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    throw err;
  }
}

/**
 * Download every available result video (health and/or business).
 * @param {object|null} testimonial
 * @param {string} [baseName]
 */
export async function downloadResultVideos(testimonial, baseName = 'transformation') {
  const videos = listResultVideos(testimonial);
  if (videos.length === 0) throw new Error('No result video is available to download');

  const files = await collectResultVideoFiles(testimonial, baseName);
  if (files.length === 0) throw new Error('Could not download the result videos');

  if (!Capacitor.isNativePlatform()) {
    await downloadFilesWeb(files);
    return;
  }

  await shareNativeVideoFiles(files);
}

/**
 * Share the Health/Business result videos as real video files (no caption text —
 * WhatsApp drops files when text is included).
 * @param {object|null} testimonial
 */
export async function shareResultVideos(testimonial) {
  const videos = listResultVideos(testimonial);
  if (videos.length === 0) throw new Error('No result video is available to share');

  if (Capacitor.isNativePlatform()) {
    await prefetchNativeResultVideos(testimonial);
    if (await shareNativeCachedVideos(testimonial)) return;
    const files = await prefetchResultVideos(testimonial);
    if (files.length === 0) throw new Error('No result video is available to share');
    await writeAndShareNative(files, { title: 'Transformation Result Videos' });
    return;
  }

  const files = await prefetchResultVideos(testimonial);
  if (files.length === 0) throw new Error('No result video is available to share');
  const videosShare = await shareFilesWeb(files, { title: 'Transformation Result Video' });
  if (videosShare === 'canceled' || videosShare === 'shared') return;
  await downloadFilesWeb(files);
}

/**
 * Share the transformation card image plus the real result videos.
 * @param {{
 *   imageBlob?: Blob|null,
 *   imageName?: string,
 *   testimonial?: object|null,
 *   videoFilesPromise?: Promise<Array>|null,
 *   title?: string,
 *   text?: string,
 * }} opts
 */
export async function shareImageAndResultVideos({
  imageBlob = null,
  imageName = 'transformation.png',
  testimonial = null,
  videoFilesPromise = null,
  title = 'My Wellness Transformation',
  text = '',
} = {}) {
  const imageFile = imageBlob
    ? {
      blob: imageBlob,
      filename: `${safeFileBase(imageName.replace(/\.[^.]+$/, ''), 'transformation')}.png`,
      mime: imageBlob.type || 'image/png',
    }
    : null;

  const videosPending = videoFilesPromise
    || (listResultVideos(testimonial).length > 0
      ? prefetchResultVideos(testimonial)
      : Promise.resolve([]));

  if (!imageFile) {
    const videoFiles = await videosPending;
    if (videoFiles.length === 0) throw new Error('Nothing to share');
    await shareVideoFiles(videoFiles);
    return;
  }

  const native = Capacitor.isNativePlatform();

  // 1. Card first — before/after photos + health issues. Do not wait for videos.
  if (native) {
    try {
      await writeAndShareNative([imageFile], { title, text });
    } catch (err) {
      if (isShareCanceled(err)) return;
      throw err;
    }
  } else {
    const imageShare = await shareFilesWeb([imageFile], { title, text });
    if (imageShare === 'canceled') return;
    if (imageShare === 'unsupported') {
      downloadBlobWeb(imageFile.blob, imageFile.filename);
    }
  }

  // 2. Then the two result videos (fetch has been running in the background).
  const videoFiles = await videosPending;
  if (videoFiles.length === 0) return;

  if (native) {
    await delay(350);
    try {
      await shareNativeVideoFiles(videoFiles);
    } catch (err) {
      if (!isShareCanceled(err)) throw err;
    }
    return;
  }

  const videosShare = await shareFilesWeb(videoFiles, {
    title: 'Transformation Result Videos',
  });
  if (videosShare === 'canceled' || videosShare === 'shared') return;
  await downloadFilesWeb(videoFiles);
}

async function shareVideoFiles(videoFiles) {
  if (Capacitor.isNativePlatform()) {
    await shareNativeVideoFiles(videoFiles);
    return;
  }
  const videosShare = await shareFilesWeb(videoFiles, {
    title: 'Transformation Result Videos',
  });
  if (videosShare === 'unsupported') await downloadFilesWeb(videoFiles);
}
