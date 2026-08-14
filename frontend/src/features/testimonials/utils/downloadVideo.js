/**
 * downloadVideo.js — download the actual result-video file (not a screenshot).
 */
import { Capacitor } from '@capacitor/core';

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read video data'));
    reader.readAsDataURL(blob);
  });
}

function extensionFromMime(mimeType, fallbackUrl) {
  const mime = String(mimeType || '').toLowerCase();
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('quicktime') || mime.includes('mov')) return 'mov';
  if (mime.includes('mp4') || mime.includes('mpeg')) return 'mp4';
  const fromUrl = String(fallbackUrl || '').split('?')[0].split('.').pop();
  if (fromUrl && /^[a-z0-9]{2,5}$/i.test(fromUrl)) return fromUrl.toLowerCase();
  return 'mp4';
}

function downloadBlobWeb(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Fetch the video at `url` and save/share the real media file.
 * @param {string} url
 * @param {string} [baseName]
 */
export async function downloadVideoFromUrl(url, baseName = 'transformation-result') {
  if (!url) throw new Error('No result video is available to download');

  let blob;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Could not download the result video');
    }
    blob = await response.blob();
  } catch (err) {
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    throw err;
  }
  if (!blob || blob.size === 0) {
    throw new Error('The result video file was empty');
  }

  const ext = extensionFromMime(blob.type, url);
  const safeName = String(baseName || 'transformation-result')
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase();
  const filename = `${safeName}.${ext}`;

  if (!Capacitor.isNativePlatform()) {
    downloadBlobWeb(blob, filename);
    return;
  }

  const { Filesystem, Directory } = await import('@capacitor/filesystem');
  const { Share } = await import('@capacitor/share');
  const dataUrl = await blobToBase64(blob);
  const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
  const saved = await Filesystem.writeFile({
    path: filename,
    data: base64,
    directory: Directory.Documents,
  });
  await Share.share({
    title: 'Transformation Result Video',
    url: saved.uri,
  });
}

/**
 * Prefer the health result video, then the business result video.
 * @param {{ healthVideoUrl?: string|null, businessVideoUrl?: string|null }} testimonial
 */
export function resolveResultVideoUrl(testimonial) {
  return testimonial?.healthVideoUrl || testimonial?.businessVideoUrl || null;
}
