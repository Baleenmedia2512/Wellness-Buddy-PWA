/**
 * saveToGalleryPlugin.js — Capacitor bridge to save images into the device gallery.
 * Android: MediaStore → Pictures/WellnessValley
 * Web: browser download fallback
 */
import { registerPlugin, Capacitor } from '@capacitor/core';

const SaveToGalleryNative = registerPlugin('SaveToGallery');

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read image data'));
    reader.readAsDataURL(blob);
  });
}

function downloadBlobWeb(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * @param {Blob} blob
 * @param {string} [fileName]
 * @returns {Promise<{ success: true, uri?: string, webDownload?: boolean }>}
 */
export async function saveImageBlobToGallery(blob, fileName = `wellness-valley-${Date.now()}.png`) {
  if (!blob) throw new Error('Image blob is required');

  if (!Capacitor.isNativePlatform()) {
    downloadBlobWeb(blob, fileName);
    return { success: true, webDownload: true };
  }

  const dataUrl = await blobToBase64(blob);
  const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
  const mimeType = blob.type || 'image/png';

  try {
    const result = await SaveToGalleryNative.saveImage({
      base64,
      fileName,
      mimeType,
    });
    return { success: true, uri: result?.uri };
  } catch (err) {
    // iOS (or missing native plugin): fall back to browser-style download via share cache
    // is not gallery — rethrow so UI can show error, unless web-like download works.
    if (Capacitor.getPlatform() === 'web') {
      downloadBlobWeb(blob, fileName);
      return { success: true, webDownload: true };
    }
    throw err;
  }
}
