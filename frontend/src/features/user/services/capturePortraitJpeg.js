/**
 * Normalize transformation photos to a portrait (3:4) JPEG.
 * Uses contain-fit (letterbox) so head/feet are not cropped to the frame.
 */

const PORTRAIT_W = 960;
const PORTRAIT_H = 1280; // 3:4
const LETTERBOX_FILL = '#111827'; // gray-900 — matches dark preview bars

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

/**
 * Fit the full image inside a portrait 3:4 canvas (no cover-crop).
 * @param {HTMLImageElement|string} source
 * @param {{ quality?: number, fillStyle?: string }} [opts]
 * @returns {Promise<string>}
 */
export async function normalizeImageToPortraitJpeg(source, opts = {}) {
  const quality = opts.quality ?? 0.88;
  const fillStyle = opts.fillStyle || LETTERBOX_FILL;
  const img = typeof source === 'string'
    ? await loadImage(source)
    : source;

  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) throw new Error('Invalid image');

  const canvas = document.createElement('canvas');
  canvas.width = PORTRAIT_W;
  canvas.height = PORTRAIT_H;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Could not prepare photo');

  ctx.fillStyle = fillStyle;
  ctx.fillRect(0, 0, PORTRAIT_W, PORTRAIT_H);

  // Contain: scale to fit entirely inside the frame (may letterbox).
  const scale = Math.min(PORTRAIT_W / iw, PORTRAIT_H / ih);
  const dw = Math.max(1, Math.round(iw * scale));
  const dh = Math.max(1, Math.round(ih * scale));
  const dx = Math.round((PORTRAIT_W - dw) / 2);
  const dy = Math.round((PORTRAIT_H - dh) / 2);
  ctx.drawImage(img, 0, 0, iw, ih, dx, dy, dw, dh);

  return canvas.toDataURL('image/jpeg', quality);
}
