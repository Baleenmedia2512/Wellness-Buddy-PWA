/**
 * TransformationShareCard.jsx
 * Clean standalone Transformation card for share/download.
 *
 * Mirrors the Diary Food Card pattern:
 *   - Off-screen (or hidden) card is captured with html2canvas
 *   - Share Photo: captures the Before vs After card (photos + health issues)
 *   - Share Video: shares the real Health/Business .mp4 files
 *   - Download Image / Download Video buttons are not shown on the member card
 *
 * html2canvas compat rules:
 *   - No flex/grid — table + block + margin:0 auto
 *   - No CSS gap — padding/margin
 *   - No inline-flex — inline-block for pills
 *   - No CSS gradients in the capture target — solid colours only
 *   - 9:16 portrait (540×960 → 1080×1920 @ scale 2) for full-screen mobile WhatsApp share
 *     (html2canvas ignores object-fit and would stretch photos on WhatsApp)
 */
import React, { useRef, useState, useCallback, forwardRef, useEffect } from 'react';
import { X, Download, Share2, CheckCircle } from 'lucide-react';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';
import { shareCachedDataUrl, shareImageDirectly } from '../../../shared/utils/shareUtils';
import { saveImageBlobToGallery } from '../../../shared/plugins/saveToGalleryPlugin';
import { APP_VERSION, getVersionString } from '../../../config/version';
import {
  shareResultVideos,
} from '../utils/downloadVideo.js';
import { drawImageCoverTop } from '../utils/fitContainSize.js';
import { healthIssueShareIcon } from '../utils/healthIssueShareIcon.js';
import {
  CARD_H,
  CARD_W,
  MAX_VISIBLE_ISSUES,
  issueColumnsForCount,
  shareCardPhotoHeight,
} from '../utils/shareCardLayout.js';
import { isTransformationWeightLoss } from '../services/testimonialFormUtils.js';
import {
  corsReloadUrl,
  isCanvasTaintError,
  isInlineCaptureSrc,
} from '../utils/shareCardCapture.js';

export { CARD_H, CARD_W };

const TICK_SIZE = 28;
const FRAME_BG = '#f3f4f6';
/** Output scale. 2× html2canvas on a 540×960 card blocked low-end phones for 20s+. */
const CAPTURE_SCALE = 1.5;
const SHARE_JPEG_QUALITY = 0.82;
const CARD_FONT = "'Poppins', Arial, Helvetica, sans-serif";
const SCRIPT_FONT = "'Pacifico', 'Segoe Script', 'Comic Sans MS', cursive";
const BEFORE_BRUSH = '#e11d72';
const AFTER_BRUSH = '#16a34a';
const PILL_BLUE = '#2563eb';
const PILL_BG = '#dbeafe';

function ensureShareCardFonts() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('wv-poppins-font')) return;
  const link = document.createElement('link');
  link.id = 'wv-poppins-font';
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Pacifico&family=Poppins:wght@500;600;700;800&display=swap';
  document.head.appendChild(link);
}
ensureShareCardFonts();

const CHECK_MARK_SRC =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none">'
    + '<path d="M20 6L9 17l-5-5" stroke="#ffffff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>'
    + '</svg>',
  );

function svgDataUri(markup) {
  return `data:image/svg+xml,${encodeURIComponent(markup)}`;
}

const RESULT_BURST_LEFT_SRC = svgDataUri(
  '<svg xmlns="http://www.w3.org/2000/svg" width="44" height="32" viewBox="0 0 44 32">'
  + '<path d="M39 16H18M31 7L12 2M31 25L12 30" fill="none" stroke="#059669" stroke-width="4" stroke-linecap="round"/>'
  + '</svg>',
);

const RESULT_BURST_RIGHT_SRC = svgDataUri(
  '<svg xmlns="http://www.w3.org/2000/svg" width="44" height="32" viewBox="0 0 44 32">'
  + '<path d="M5 16h21M13 7l19-5M13 25l19 5" fill="none" stroke="#059669" stroke-width="4" stroke-linecap="round"/>'
  + '</svg>',
);

function escapeSvgText(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Result pill as SVG so html2canvas centers the label (DOM span padding was
 * left-shifted — font metrics made the blue box wider than the glyphs).
 */
function buildResultPillSrc(label) {
  const text = String(label || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  const padX = 18;
  // Bold 15px Arial advance ≈ 0.62em; keep a small safety margin.
  const textW = Math.ceil(text.length * 9.2);
  const w = Math.max(120, textW + padX * 2);
  const h = 30;
  const midY = 20;
  return svgDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`
    + `<rect x="0" y="0" width="${w}" height="${h}" rx="15" ry="15" fill="${PILL_BG}"/>`
    + `<text x="${w / 2}" y="${midY}" text-anchor="middle" `
    + 'font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="800" '
    + `fill="${PILL_BLUE}">${escapeSvgText(text)}</text>`
    + '</svg>',
  );
}

/**
 * Compact disclaimer footer as one SVG so html2canvas always paints the text
 * (nested DOM text inside yellow inline-block was blank in the share bitmap).
 * Height must stay in sync with DISCLAIMER_H in shareCardLayout.js.
 */
const DISCLAIMER_FOOTER_SRC = svgDataUri(
  '<svg xmlns="http://www.w3.org/2000/svg" width="420" height="88" viewBox="0 0 420 88">' +
  '<rect x="8" y="4" width="404" height="80" rx="12" ry="12" fill="#fff" stroke="#dc2626" stroke-width="3"/>' +
  '<text x="210" y="24" text-anchor="middle" font-family="Arial Black, Arial, Helvetica, sans-serif" font-size="14" font-weight="900" fill="#dc2626">DISCLAIMER</text>' +
  '<line x1="45" y1="30" x2="375" y2="30" stroke="#dc2626" stroke-width="1.5"/>' +
  '<text x="210" y="50" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="11" font-weight="600" fill="#000000">The views expressed are that of individuals.</text>' +
  '<text x="210" y="68" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="11" font-weight="600" fill="#000000">These products are not intended to diagnose, treat or cure any disease.</text>' +
  '</svg>'
);

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read image'));
    reader.readAsDataURL(blob);
  });
}

/** Absolute logo URL — Capacitor often fails on bare `/logo.png` during capture. */
function shareCardLogoFetchUrl() {
  try {
    return new URL('/logo.png', window.location.origin).href;
  } catch {
    return '/logo.png';
  }
}

async function fetchImageAsDataUrl(src) {
  const res = await fetch(src);
  if (!res.ok) return null;
  const blob = await res.blob();
  if (!String(blob.type || '').startsWith('image/')) return null;
  return blobToDataUrl(blob);
}

function decodeImageElement(src, { crossOrigin = null } = {}) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    if (crossOrigin) image.crossOrigin = crossOrigin;
    const timer = setTimeout(() => {
      image.onload = null;
      image.onerror = null;
      reject(new Error('Transformation photo took too long to load'));
    }, 4000);
    image.onload = () => {
      clearTimeout(timer);
      if (image.naturalWidth > 0) resolve(image);
      else reject(new Error('Transformation photo is empty'));
    };
    image.onerror = () => {
      clearTimeout(timer);
      reject(new Error('Transformation photo failed to load'));
    };
    image.src = src;
  });
}

/**
 * Read photo pixels in CORS mode.
 * A painted <img> can be tainted (displayed via a no-cors load) even when the
 * bucket allows a real CORS fetch — that is the Full Team share failure.
 */
async function loadUntaintedPhoto(src) {
  const attempts = [src];
  const busted = corsReloadUrl(src);
  if (busted !== src) attempts.push(busted);
  let lastErr = null;
  for (const candidate of attempts) {
    try {
      const dataUrl = await fetchImageAsDataUrl(candidate);
      if (!dataUrl) continue;
      return await decodeImageElement(dataUrl);
    } catch (err) {
      lastErr = err;
    }
  }
  for (const candidate of attempts) {
    try {
      return await decodeImageElement(candidate, { crossOrigin: 'anonymous' });
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('Could not read transformation photo');
}

async function inlineImagesForCapture(el) {
  const imgs = Array.from(el.querySelectorAll('img'));
  await Promise.all(imgs.map(async (img) => {
    const isLogo = img.hasAttribute('data-share-logo');
    const src = img.currentSrc || img.getAttribute('src') || '';
    if (isInlineCaptureSrc(src)) return;
    // Before/After are baked later. A decoded photo may be a no-cors bitmap;
    // inlining it here used to skip the CORS refetch that Full Team needs.
    if (img.hasAttribute('data-keep-ratio')) return;
    if (img.complete && img.naturalWidth > 0) return;
    const candidates = isLogo
      ? [src, shareCardLogoFetchUrl(), '/logo.png'].filter(Boolean)
      : [src].filter(Boolean);
    for (const candidate of candidates) {
      try {
        const dataUrl = await fetchImageAsDataUrl(candidate);
        if (!dataUrl) continue;
        img.removeAttribute('crossorigin');
        img.src = dataUrl;
        return;
      } catch {
        // try next candidate
      }
    }
  }));
}

function waitForImage(img) {
  return new Promise((resolve) => {
    if (img.complete && img.naturalWidth > 0) {
      resolve();
      return;
    }
    const done = () => resolve();
    img.addEventListener('load', done, { once: true });
    img.addEventListener('error', done, { once: true });
    setTimeout(done, 1500);
  });
}

function paintCoverPhoto(source, w, h, scale) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = FRAME_BG;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawImageCoverTop(ctx, source, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.95);
}

/**
 * Paint each photo into a 2× canvas using cover + top crop.
 * Baking at CSS size made html2canvas upscale a small JPEG and the share looked blurry.
 * Full Team photos are often already decoded as a no-cors bitmap; exporting that taints
 * the canvas. On SecurityError, reload the same URL in CORS mode and bake that.
 */
async function bakeKeepRatioPhotos(el, scale = CAPTURE_SCALE) {
  const imgs = Array.from(el.querySelectorAll('img[data-keep-ratio]'));
  await Promise.all(imgs.map(async (img) => {
    const w = Math.round(img.clientWidth || img.width || 0);
    const h = Math.round(img.clientHeight || img.height || 0);
    if (w < 2 || h < 2) return;
    const src = img.currentSrc || img.getAttribute('src') || '';
    let source = img;
    if (!source.naturalWidth || !source.naturalHeight) {
      if (isInlineCaptureSrc(src)) return;
      source = await loadUntaintedPhoto(src);
    }
    let dataUrl;
    try {
      dataUrl = paintCoverPhoto(source, w, h, scale);
    } catch (err) {
      if (!isCanvasTaintError(err) || isInlineCaptureSrc(src)) throw err;
      source = await loadUntaintedPhoto(src);
      dataUrl = paintCoverPhoto(source, w, h, scale);
    }
    if (!dataUrl) return;
    img.removeAttribute('crossorigin');
    img.src = dataUrl;
    img.style.width = `${w}px`;
    img.style.height = `${h}px`;
    img.style.objectFit = 'fill';
    img.setAttribute('width', String(w));
    img.setAttribute('height', String(h));
  }));
}

function waitForPacifico(maxMs) {
  if (!document.fonts?.load) return Promise.resolve();
  return Promise.race([
    document.fonts.load('40px Pacifico').catch(() => {}),
    new Promise((resolve) => { setTimeout(resolve, maxMs); }),
  ]);
}

async function renderTransformationCardCanvas(el) {
  ensureShareCardFonts();
  await waitForPacifico(400);
  el.querySelectorAll('[data-brush-label]').forEach((node) => {
    const word = node.getAttribute('data-brush-label') || '';
    const img = node.querySelector('img[data-brush-word]');
    if (!img || !word) return;
    const width = node.clientWidth || BRUSH_LABEL_W;
    img.width = width;
    img.style.width = `${width}px`;
    img.style.height = `${BRUSH_LABEL_H}px`;
    img.src = paintCenteredBrushLabel(word, width);
  });
  await inlineImagesForCapture(el);
  const cardImages = Array.from(el.querySelectorAll('img'));
  await Promise.all(cardImages.map(waitForImage));
  const photos = Array.from(el.querySelectorAll('img[data-keep-ratio]'));
  await bakeKeepRatioPhotos(el, CAPTURE_SCALE);
  await Promise.all(photos.map(waitForImage));
  const html2canvas = (await import('html2canvas')).default;
  return html2canvas(el, {
    useCORS: true,
    allowTaint: false,
    scale: CAPTURE_SCALE,
    backgroundColor: '#ffffff',
    logging: false,
    imageTimeout: 2000,
    removeContainer: true,
    foreignObjectRendering: false,
  });
}

export async function captureTransformationCardAsBlob(el) {
  const canvas = await renderTransformationCardCanvas(el);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to create image from transformation card'));
    }, 'image/png');
  });
}

/** JPEG data URL used by the share sheet. One encode — no PNG round-trip. */
export async function captureTransformationCardShareDataUrl(el) {
  const canvas = await renderTransformationCardCanvas(el);
  return canvas.toDataURL('image/jpeg', SHARE_JPEG_QUALITY);
}

/**
 * Resolve Before/After img nodes by slot (never by DOM order alone).
 * @param {HTMLElement} el
 */
function photoSlotImages(el) {
  const beforeImg = el.querySelector('img[data-photo-slot="before"]')
    || el.querySelectorAll('img[data-keep-ratio]')[0]
    || null;
  const afterImg = el.querySelector('img[data-photo-slot="after"]')
    || el.querySelectorAll('img[data-keep-ratio]')[1]
    || null;
  return { beforeImg, afterImg };
}

/**
 * Ensure Before/After photos on the share card are painted before capture.
 * Optionally swap in draft data-URLs so email matches the in-app pair.
 * @param {HTMLElement} el
 * @param {{ beforeSrc?: string|null, afterSrc?: string|null }} [photoSrc]
 */
export async function prepareTransformationCardPhotos(el, photoSrc = {}) {
  if (!el) return;
  const { beforeImg, afterImg } = photoSlotImages(el);
  if (beforeImg && photoSrc.beforeSrc) {
    beforeImg.removeAttribute('crossorigin');
    beforeImg.src = photoSrc.beforeSrc;
  }
  if (afterImg && photoSrc.afterSrc) {
    afterImg.removeAttribute('crossorigin');
    afterImg.src = photoSrc.afterSrc;
  }
  const imgs = [beforeImg, afterImg].filter(Boolean);
  await Promise.all(imgs.map(waitForImage));
  // Reject captures where After never decoded (avoids baking wrong/blank pixels).
  if (afterImg && !(afterImg.complete && afterImg.naturalWidth > 0)) {
    throw new Error('After photo not ready for transformation card capture');
  }
  if (beforeImg && !(beforeImg.complete && beforeImg.naturalWidth > 0)) {
    throw new Error('Before photo not ready for transformation card capture');
  }
}

/**
 * JPEG data URL of the share card for coach OTP email upload (keeps under API size limit).
 * Captures a CLONE so the live share card is never mutated (prevents wrong After bake).
 * @param {HTMLElement} el
 * @param {{ quality?: number, maxBase64Chars?: number, beforeSrc?: string|null, afterSrc?: string|null }} [opts]
 * @returns {Promise<string>}
 */
export async function captureTransformationCardAsJpegDataUrl(el, opts = {}) {
  if (!el) throw new Error('Transformation card is not ready');
  const quality = opts.quality ?? 0.82;
  const maxBase64Chars = opts.maxBase64Chars ?? Math.floor(1.35 * 1024 * 1024);

  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = [
    'position:fixed',
    'left:0',
    'top:0',
    `width:${CARD_W}px`,
    `height:${CARD_H}px`,
    'opacity:1',
    'pointer-events:none',
    'z-index:-1',
    'overflow:hidden',
  ].join(';');
  const clone = el.cloneNode(true);
  clone.removeAttribute('id');
  host.appendChild(clone);
  document.body.appendChild(host);

  try {
    await prepareTransformationCardPhotos(clone, {
      beforeSrc: opts.beforeSrc,
      afterSrc: opts.afterSrc,
    });
    const pngBlob = await captureTransformationCardAsBlob(clone);
    const bitmap = typeof createImageBitmap === 'function'
      ? await createImageBitmap(pngBlob)
      : null;

    const canvas = document.createElement('canvas');
    if (bitmap) {
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not encode transformation card');
      ctx.drawImage(bitmap, 0, 0);
      if (typeof bitmap.close === 'function') bitmap.close();
    } else {
      const pngUrl = await blobToDataUrl(pngBlob);
      const img = await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Could not encode transformation card'));
        image.src = pngUrl;
      });
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not encode transformation card');
      ctx.drawImage(img, 0, 0);
    }

    let q = quality;
    let dataUrl = canvas.toDataURL('image/jpeg', q);
    while (dataUrl.length > maxBase64Chars && q > 0.45) {
      q = Math.max(0.45, q - 0.08);
      dataUrl = canvas.toDataURL('image/jpeg', q);
    }
    return dataUrl;
  } finally {
    host.remove();
  }
}

function transformationFileName(userName) {
  return `transformation-${String(userName || 'result').replace(/\s+/g, '-').toLowerCase()}.png`;
}

function transformationShareOptions(userName) {
  return {
    title: 'My Wellness Transformation',
    text: '',
    fileName: transformationFileName(userName),
  };
}

export async function sharePreparedTransformationCard(dataUrl, userName) {
  const opts = transformationShareOptions(userName);
  const shared = await shareCachedDataUrl(dataUrl, opts);
  if (!shared) await shareImageDirectly(dataUrl, opts);
}

export async function shareTransformationCard(element, userName, _testimonial = null) {
  if (!element) throw new Error('Transformation card is not ready');
  const dataUrl = await captureTransformationCardShareDataUrl(element);
  await sharePreparedTransformationCard(dataUrl, userName);
}

let shareWarmChain = Promise.resolve();

function enqueueShareWarm(task) {
  const run = shareWarmChain.then(task, task);
  shareWarmChain = run.then(() => {}, () => {});
  return run;
}

function shareCardCacheKey(testimonial, userName) {
  const issues = Array.isArray(testimonial?.recoveredHealthIssues)
    ? testimonial.recoveredHealthIssues.join('|')
    : '';
  return [
    userName || '',
    testimonial?.beforeImageUrl || '',
    testimonial?.afterImageUrl || '',
    testimonial?.beforeWeightKg ?? '',
    testimonial?.afterWeightKg ?? '',
    testimonial?.durationText || '',
    testimonial?.goalType || '',
    testimonial?.status || '',
    issues,
  ].join('\u0001');
}

export async function downloadTransformationCardImage(element, userName) {
  if (!element) throw new Error('Transformation card is not ready');
  const blob = await captureTransformationCardAsBlob(element);
  await saveImageBlobToGallery(blob, transformationFileName(userName));
}

function VerifiedTick() {
  const inset = Math.round((TICK_SIZE - 14) / 2);
  return (
    <span
      style={{
        position: 'absolute',
        top: 8,
        left: 8,
        width: TICK_SIZE,
        height: TICK_SIZE,
        borderRadius: TICK_SIZE / 2,
        background: '#16a34a',
        boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
        overflow: 'hidden',
      }}
      aria-label="Verified"
    >
      <img
        src={CHECK_MARK_SRC}
        alt=""
        width={14}
        height={14}
        style={{
          display: 'block',
          position: 'absolute',
          top: inset,
          left: inset,
          width: 14,
          height: 14,
        }}
      />
    </span>
  );
}

const BRUSH_LABEL_W = 240;
const BRUSH_LABEL_H = 48;

/**
 * Paint Before/After the same way the on-screen label is centered.
 * html2canvas shifts CSS text-align + rotate, so WhatsApp and mail were
 * getting an off-center word. A bitmap keeps the center.
 */
function paintCenteredBrushLabel(label, width = BRUSH_LABEL_W) {
  const boxW = Math.max(120, Math.round(width) || BRUSH_LABEL_W);
  const scale = 3;
  const canvas = document.createElement('canvas');
  canvas.width = boxW * scale;
  canvas.height = BRUSH_LABEL_H * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.scale(scale, scale);
  ctx.clearRect(0, 0, boxW, BRUSH_LABEL_H);
  ctx.translate(boxW / 2, BRUSH_LABEL_H / 2);
  ctx.rotate((-3 * Math.PI) / 180);
  ctx.font = `40px ${SCRIPT_FONT}`;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.36)';
  ctx.shadowBlur = 5;
  ctx.shadowOffsetY = 2;
  ctx.fillText(String(label || ''), 0, 1);
  return canvas.toDataURL('image/png');
}

function BrushScriptLabel({ label }) {
  const imgRef = useRef(null);
  const [src, setSrc] = useState('');

  useEffect(() => {
    let cancelled = false;
    const paint = () => {
      if (cancelled) return;
      const width = imgRef.current?.parentElement?.clientWidth || BRUSH_LABEL_W;
      setSrc(paintCenteredBrushLabel(label, width));
    };
    const ready = document.fonts?.load
      ? document.fonts.load('40px Pacifico').then(paint, paint)
      : Promise.resolve().then(paint);
    ready.catch(paint);
    return () => {
      cancelled = true;
    };
  }, [label]);

  return (
    <img
      ref={imgRef}
      data-brush-word="1"
      alt={label}
      src={src || undefined}
      draggable={false}
      width={BRUSH_LABEL_W}
      height={BRUSH_LABEL_H}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 20,
        width: '100%',
        height: BRUSH_LABEL_H,
        margin: 0,
        padding: 0,
        border: 0,
        pointerEvents: 'none',
      }}
    />
  );
}

function BrushLabel({ label, side }) {
  const color = side === 'left' ? BEFORE_BRUSH : AFTER_BRUSH;
  return (
    <div
      data-brush-label={label}
      style={{
        position: 'absolute',
        left: '7%',
        right: '7%',
        bottom: 16,
        height: 92,
        textAlign: 'center',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 3,
          right: 1,
          top: 19,
          height: 53,
          display: 'block',
          background: color,
          borderRadius: '38% 13% 35% 18% / 30% 48% 35% 52%',
          transform: 'rotate(-2deg) skewX(-7deg)',
          opacity: 0.96,
        }}
      />
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 13,
          right: 16,
          top: 13,
          height: 14,
          display: 'block',
          background: color,
          borderRadius: '70% 16% 65% 12%',
          transform: 'rotate(2deg)',
          opacity: 0.76,
        }}
      />
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 0,
          right: 22,
          top: 62,
          height: 10,
          display: 'block',
          background: color,
          borderRadius: '20% 75% 18% 70%',
          transform: 'rotate(1deg)',
          opacity: 0.72,
        }}
      />
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 8,
          right: 8,
          top: 35,
          height: 12,
          display: 'block',
          background: color,
          borderRadius: '65% 20% 70% 16%',
          transform: 'rotate(-5deg)',
          opacity: 0.65,
        }}
      />
      <BrushScriptLabel label={label} />
    </div>
  );
}

function PhotoCell({ src, label, scriptLabel, weightKg, isVerified, side, photoH }) {
  return (
    <td
      style={{
        width: '50%',
        verticalAlign: 'top',
        padding: 0,
      }}
    >
      <div style={side === 'left' ? { paddingRight: 4 } : { paddingLeft: 4 }}>
        <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 14 }}>
          {src ? (
            <img
              alt={label}
              data-keep-ratio="1"
              data-photo-slot={side === 'left' ? 'before' : 'after'}
              crossOrigin="anonymous"
              src={src}
              style={{
                display: 'block',
                width: '100%',
                height: photoH,
                objectFit: 'cover',
                objectPosition: 'top',
              }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: photoH,
                background: FRAME_BG,
              }}
            />
          )}
          <BrushLabel label={scriptLabel} side={side} />
          {isVerified && src ? <VerifiedTick /> : null}
        </div>
        <p style={{
          margin: '8px 0 0',
          textAlign: 'center',
          fontSize: 11,
          fontWeight: 700,
          color: '#9ca3af',
          letterSpacing: '1.4px',
          textTransform: 'uppercase',
          lineHeight: '14px',
          fontFamily: CARD_FONT,
        }}
        >
          {label}
        </p>
        {weightKg > 0 && (
          <p style={{
            margin: '3px 0 6px',
            textAlign: 'center',
            fontSize: 17,
            fontWeight: 800,
            color: '#111827',
            lineHeight: '22px',
            fontFamily: CARD_FONT,
            overflow: 'visible',
          }}
          >
            {weightKg} kg
          </p>
        )}
      </div>
    </td>
  );
}

function HealthIssueChip({ label, widthPct }) {
  return (
    <div
      style={{
        display: 'inline-block',
        width: `${widthPct}%`,
        verticalAlign: 'top',
        padding: '3px 4px',
        boxSizing: 'border-box',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          display: 'block',
          width: '100%',
          minHeight: 36,
          padding: '8px 8px',
          boxSizing: 'border-box',
          border: '1.5px solid #f9a8d4',
          borderRadius: 8,
          background: '#ffffff',
          color: '#4b5563',
          fontFamily: CARD_FONT,
          fontSize: 14,
          fontWeight: 700,
          lineHeight: '18px',
          textAlign: 'center',
          overflowWrap: 'anywhere',
        }}
      >
        {label}
      </div>
    </div>
  );
}

/**
 * Standalone transformation card — capture this element, never the page.
 * Before vs After photos + health issues. Videos are shared as real files.
 */
export const TransformationCardContent = forwardRef(function TransformationCardContent(
  { testimonial, userName },
  ref,
) {
  const bw = Number(testimonial?.beforeWeightKg ?? 0);
  const aw = Number(testimonial?.afterWeightKg ?? 0);
  const beforeSrc = testimonial?.beforeImageUrl || null;
  const afterSrc = testimonial?.afterImageUrl || null;
  const showPhotoRow = Boolean(beforeSrc || afterSrc || bw > 0 || aw > 0);
  const isLoss = isTransformationWeightLoss(bw, aw);
  const diff = isLoss == null ? null : Math.abs(aw - bw).toFixed(1);
  const isVerified = testimonial?.status === 'verified';
  const verb = isLoss === false ? 'Gained' : 'Lost';
  const rawIssues = testimonial?.recoveredHealthIssues;
  const issues = (Array.isArray(rawIssues) ? rawIssues : []).filter(Boolean).slice(0, MAX_VISIBLE_ISSUES);
  const durationRaw = String(testimonial?.durationText || '').trim();
  const durationText = durationRaw && durationRaw !== '—' && durationRaw !== '-' ? durationRaw : '';
  const displayName = String(userName || 'Customer').trim() || 'Customer';
  const issuesPerRow = issueColumnsForCount(issues.length);
  const chipWidthPct = issuesPerRow > 0 ? 100 / issuesPerRow : 100;
  // Single trimmed label — SVG pill keeps it optically centered in the capture.
  // Equal before/after has no lost/gained line, so show duration on its own.
  const resultPillLabel = diff
    ? [verb, `${diff} kgs`, durationText ? `in ${durationText}` : null].filter(Boolean).join(' ')
    : durationText;
  const photoH = shareCardPhotoHeight({
    issueCount: issues.length,
    hasResultPill: Boolean(resultPillLabel),
  });
  const resultPillSrc = resultPillLabel ? buildResultPillSrc(resultPillLabel) : '';

  return (
    <div
      ref={ref}
      id="wv-transformation-share-card"
      style={{
        position: 'relative',
        width: CARD_W,
        height: CARD_H,
        background: '#ffffff',
        overflow: 'hidden',
        fontFamily: CARD_FONT,
        boxSizing: 'border-box',
      }}
    >
      <div style={{ background: '#059669', padding: '10px 16px 8px' }}>
        <table
          style={{ width: '100%', borderCollapse: 'collapse' }}
          cellPadding={0}
          cellSpacing={0}
        >
          <tbody>
            <tr>
              <td style={{ width: 44, verticalAlign: 'middle', padding: 0, paddingRight: 10, lineHeight: 0 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 19,
                    background: '#ffffff',
                    overflow: 'hidden',
                    textAlign: 'center',
                    lineHeight: '38px',
                  }}
                >
                  <img
                    data-share-logo="1"
                    src={shareCardLogoFetchUrl()}
                    alt="Wellness Valley"
                    style={{
                      display: 'inline-block',
                      width: 30,
                      height: 30,
                      objectFit: 'contain',
                      verticalAlign: 'middle',
                    }}
                  />
                </div>
              </td>
              <td style={{ verticalAlign: 'middle', padding: 0, lineHeight: 0 }}>
                <p style={{ margin: 0, color: '#ffffff', fontSize: 20, fontWeight: 800, lineHeight: '26px' }}>
                  {`Wellness Valley (${String(APP_VERSION.VERSION || getVersionString()).replace(/\s+/g, '')})`}
                </p>
                <p style={{
                  margin: '2px 0 0',
                  color: '#a7f3d0',
                  fontSize: 13,
                  fontWeight: 600,
                  lineHeight: '18px',
                }}
                >
                  Transformation Results
                </p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style={{ padding: '13px 16px 11px', textAlign: 'center' }}>
        <p style={{
          margin: 0,
          fontSize: 22,
          fontWeight: 800,
          color: '#111827',
          lineHeight: '28px',
          letterSpacing: '0.3px',
          fontFamily: CARD_FONT,
          whiteSpace: 'nowrap',
        }}
        >
          {displayName}
        </p>
      </div>

      {showPhotoRow && (
        <div style={{ padding: '0 12px' }}>
          <table
            style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}
            cellPadding={0}
            cellSpacing={0}
          >
            <tbody>
              <tr>
                <PhotoCell
                  src={beforeSrc}
                  label="BEFORE"
                  scriptLabel="Before"
                  weightKg={bw}
                  isVerified={isVerified}
                  side="left"
                  photoH={photoH}
                />
                <PhotoCell
                  src={afterSrc}
                  label="AFTER"
                  scriptLabel="After"
                  weightKg={aw}
                  isVerified={isVerified}
                  side="right"
                  photoH={photoH}
                />
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <table
        style={{ width: '100%', borderCollapse: 'collapse' }}
        cellPadding={0}
        cellSpacing={0}
      >
        <tbody>
          {resultPillSrc ? (
            <tr>
              <td
                align="center"
                style={{
                  padding: '8px 0 2px',
                  verticalAlign: 'top',
                  textAlign: 'center',
                  fontSize: 0,
                }}
              >
                <img
                  src={RESULT_BURST_LEFT_SRC}
                  alt=""
                  aria-hidden="true"
                  width={32}
                  height={24}
                  style={{
                    display: 'inline-block',
                    width: 32,
                    height: 24,
                    marginRight: 6,
                    verticalAlign: 'middle',
                  }}
                />
                <img
                  src={resultPillSrc}
                  alt={resultPillLabel}
                  style={{
                    display: 'inline-block',
                    height: 30,
                    width: 'auto',
                    verticalAlign: 'middle',
                  }}
                />
                <img
                  src={RESULT_BURST_RIGHT_SRC}
                  alt=""
                  aria-hidden="true"
                  width={32}
                  height={24}
                  style={{
                    display: 'inline-block',
                    width: 32,
                    height: 24,
                    marginLeft: 6,
                    verticalAlign: 'middle',
                  }}
                />
              </td>
            </tr>
          ) : null}
          {issues.length > 0 ? (
            <tr>
              <td style={{ padding: '4px 12px 6px', verticalAlign: 'top' }}>
                <div
                  style={{
                    background: '#fff1f2',
                    border: '1px solid #f9a8d4',
                    borderRadius: 12,
                    boxShadow: '0 1px 3px rgba(190, 24, 93, 0.12)',
                    padding: '4px 6px 4px',
                    boxSizing: 'border-box',
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontFamily: SCRIPT_FONT,
                      fontSize: 18,
                      lineHeight: '22px',
                      color: '#be185d',
                      textAlign: 'center',
                    }}
                  >
                    Health Issues
                  </p>
                  <p
                    style={{
                      margin: '0 0 10px',
                      fontSize: 9,
                      fontWeight: 500,
                      fontStyle: 'italic',
                      color: '#9ca3af',
                      lineHeight: '12px',
                      textAlign: 'center',
                    }}
                  >
                    while joining the community
                  </p>
                  <div style={{ textAlign: 'center', fontSize: 0, paddingBottom: 6 }}>
                    {issues.map((issue) => (
                      <HealthIssueChip
                        key={issue}
                        label={issue}
                        widthPct={chipWidthPct}
                      />
                    ))}
                  </div>
                </div>
              </td>
            </tr>
          ) : (
            <tr>
              <td style={{ padding: '0 0 2px' }} />
            </tr>
          )}
        </tbody>
      </table>

      
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          boxSizing: 'border-box',
          margin: 0,
          padding: '10px 16px 12px',
          backgroundColor: '#FFF2A6',
          borderTop: '2px solid #E52525',
          borderLeft: '2px solid #E52525',
          borderRight: '2px solid #E52525',
          borderBottom: '2px solid #E52525',
          textAlign: 'left',
        }}
      >
        <div
          style={{
            margin: 0,
            color: '#E52525',
            fontSize: 12,
            fontWeight: 800,
            lineHeight: '16px',
            letterSpacing: '0.5px',
            textAlign: 'center',
          }}
        >
          DISCLAIMER
        </div>
        <div
          style={{
            height: 1,
            margin: '6px 0 8px',
            backgroundColor: '#E52525',
          }}
        />
        <p
          style={{
            margin: 0,
            color: '#171717',
            fontSize: 12,
            fontWeight: 700,
            lineHeight: '18px',
            textAlign: 'left',
          }}
        >
          The views expressed are those of individuals.
        </p>
        <p
          style={{
            margin: '2px 0 0',
            color: '#171717',
            fontSize: 12,
            fontWeight: 700,
            lineHeight: '18px',
            textAlign: 'left',
          }}
        >
          These products are not intended to diagnose, treat or cure any disease.
        </p>
      </div>

        </div>
      );
    });

/**
 * Optional preview modal — kept for callers that still open a preview.
 * Share/download still capture the card element, never the surrounding page.
 */
export default function TransformationShareCard({
  testimonial,
  userName,
  hasAfter,
  videoThumbnailUrl,
  onClose,
}) {
  const cardRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [busyMode, setBusyMode] = useState(null);
  const [status, setStatus] = useState(null);

  const run = useCallback(async (mode) => {
    if (!cardRef.current || busy) return;
    setBusy(true);
    setBusyMode(mode);
    setStatus(null);
    try {
      if (mode === 'share') {
        await shareTransformationCard(cardRef.current, userName, testimonial);
        setStatus('shared');
      } else {
        await downloadTransformationCardImage(cardRef.current, userName);
        setStatus('saved');
      }
    } catch {
      setStatus('error');
    } finally {
      setBusy(false);
      setBusyMode(null);
    }
  }, [busy, testimonial, userName]);

  return (
    <div
      className="fixed inset-0 z-[110] bg-black/75 flex flex-col items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="w-full max-w-[340px] space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <p className="text-white text-sm font-semibold">Your Transformation Card</p>
          <button type="button" onClick={onClose} className="p-1.5 rounded-full bg-white/20 text-white hover:bg-white/30">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-auto rounded-2xl shadow-2xl" style={{ maxHeight: '65vh' }}>
          <TransformationCardContent
            ref={cardRef}
            testimonial={testimonial}
            userName={userName}
          />
        </div>

        {status === 'saved' && (
          <p className="text-green-400 text-xs text-center font-semibold flex items-center justify-center gap-1">
            <CheckCircle className="h-3.5 w-3.5" /> Saved to Gallery
          </p>
        )}
        {status === 'shared' && (
          <p className="text-green-400 text-xs text-center font-semibold flex items-center justify-center gap-1">
            <CheckCircle className="h-3.5 w-3.5" /> Ready to share
          </p>
        )}
        {status === 'error' && (
          <p className="text-red-400 text-xs text-center">Could not save the transformation card. Please try again.</p>
        )}

        <div className="flex gap-3">
          <TouchFeedbackButton
            onClick={() => run('download')}
            disabled={busy}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-white text-gray-800 text-sm font-bold shadow disabled:opacity-60"
          >
            <Download className="h-4 w-4" /> {busyMode === 'download' ? 'Saving…' : 'Download Image'}
          </TouchFeedbackButton>
          <TouchFeedbackButton
            onClick={() => run('share')}
            disabled={busy}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-green-500 text-white text-sm font-bold shadow disabled:opacity-60"
          >
            <Share2 className="h-4 w-4" /> Share
          </TouchFeedbackButton>
        </div>
      </div>
    </div>
  );
}

/**
 * Single Share control. kind="photo" shares the Before vs After card.
 * kind="video" shares the real Health/Business result videos.
 * variant="icon" — compact top-of-card share icon; "button" — full-width CTA.
 */
export function TransformationShareActions({
  kind = 'photo',
  cardRef,
  userName,
  testimonial = null,
  disabled = false,
  onBeforeAction,
  variant = 'button',
  className = '',
}) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const isVideo = kind === 'video';
  const isIcon = variant === 'icon';
  const readyShareRef = useRef({ key: '', dataUrl: null, pending: null });
  const shareKey = isVideo ? '' : shareCardCacheKey(testimonial, userName);

  useEffect(() => {
    if (isVideo) return undefined;
    void import('html2canvas');
    const key = shareKey;
    if (
      readyShareRef.current.key === key
      && (readyShareRef.current.dataUrl || readyShareRef.current.pending)
    ) {
      return undefined;
    }
    let cancelled = false;
    readyShareRef.current = { key, dataUrl: null, pending: null };
    const timer = window.setTimeout(() => {
      const el = cardRef?.current;
      if (!el || cancelled) return;
      const pending = enqueueShareWarm(() => captureTransformationCardShareDataUrl(el))
        .then((dataUrl) => {
          if (!cancelled && readyShareRef.current.key === key) {
            readyShareRef.current.dataUrl = dataUrl;
            readyShareRef.current.pending = null;
          }
          return dataUrl;
        })
        .catch(() => null);
      readyShareRef.current.pending = pending;
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [cardRef, isVideo, shareKey]);

  const run = useCallback(async () => {
    if (disabled || busy) return;
    setBusy(true);
    setStatus(null);
    try {
      if (!isVideo) {
        // Share the card already on screen. Direct and Full both have photo URLs
        // on the list row. Refetching detail swaps those URLs and reloads the
        // photos as a no-cors bitmap, which makes toDataURL throw on Full Team.
        const slot = readyShareRef.current;
        let dataUrl = slot.key === shareKey ? slot.dataUrl : null;
        if (!dataUrl && slot.key === shareKey && slot.pending) {
          dataUrl = await slot.pending;
        }
        if (!dataUrl && cardRef?.current) {
          dataUrl = await captureTransformationCardShareDataUrl(cardRef.current);
          if (readyShareRef.current.key === shareKey) {
            readyShareRef.current.dataUrl = dataUrl;
          }
        }
        if (dataUrl) await sharePreparedTransformationCard(dataUrl, userName);
        else await shareTransformationCard(cardRef?.current, userName, testimonial);
        setStatus('shared');
        return;
      }
      let resolved = testimonial;
      if (typeof onBeforeAction === 'function') {
        const detail = await onBeforeAction();
        if (detail) resolved = detail;
      }
      await shareResultVideos(resolved);
      setStatus('shared');
    } catch (err) {
      const msg = String(err?.message || err?.name || '').toLowerCase();
      if (msg.includes('cancel') || msg.includes('abort') || msg.includes('dismiss')) {
        setStatus(null);
        return;
      }
      console.error('[testimonials] share failed', err);
      setStatus('error');
    } finally {
      setBusy(false);
    }
  }, [busy, cardRef, disabled, isVideo, onBeforeAction, shareKey, testimonial, userName]);

  if (isIcon) {
    return (
      <div className={`relative shrink-0 ${className}`}>
        <TouchFeedbackButton
          onClick={run}
          disabled={disabled || busy}
          className="p-2 rounded-full text-green-700 hover:bg-green-50 disabled:opacity-50 transition-colors"
          aria-label={isVideo ? 'Share video' : 'Share transformation card'}
        >
          <Share2 className={`h-5 w-5 ${busy ? 'animate-pulse' : ''}`} />
        </TouchFeedbackButton>
        {status === 'error' && (
          <p className="absolute right-0 top-full mt-1 whitespace-nowrap text-[10px] text-red-600">
            Share failed
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={`space-y-1 pt-0.5 ${className}`}>
      <TouchFeedbackButton
        onClick={run}
        disabled={disabled || busy}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-600 text-white text-[12px] font-bold disabled:opacity-60"
      >
        <Share2 className="h-4 w-4" />
        {busy
          ? 'Sharing…'
          : isVideo
            ? 'Share Video'
            : 'Share Image'}
      </TouchFeedbackButton>
      {status === 'shared' && (
        <p className="text-[11px] text-green-700 text-center font-semibold">
          {isVideo ? 'Result videos ready to share' : 'Transformation card ready to share'}
        </p>
      )}
      {status === 'error' && (
        <p className="text-[11px] text-red-600 text-center">Could not complete that action. Please try again.</p>
      )}
    </div>
  );
}
