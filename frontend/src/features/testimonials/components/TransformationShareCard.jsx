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
import { shareImageDirectly } from '../../../shared/utils/shareUtils';
import { saveImageBlobToGallery } from '../../../shared/plugins/saveToGalleryPlugin';
import { getVersionString } from '../../../config/version';
import {
  shareResultVideos,
} from '../utils/downloadVideo.js';
import { drawImageCoverTop } from '../utils/fitContainSize.js';
import { healthIssueShareIcon } from '../utils/healthIssueShareIcon.js';

/** 9:16 mobile portrait — 540×960 CSS px → 1080×1920 PNG @ CAPTURE_SCALE 2 */
export const CARD_W = 540;
export const CARD_H = 960;
const PHOTO_H_WITH_ISSUES = 590;
const PHOTO_H_MANY_ISSUES = 490;
const PHOTO_H_PLAIN = 690;
const TICK_SIZE = 28;
const MAX_VISIBLE_ISSUES = 6;
const FRAME_BG = '#f3f4f6';
const CAPTURE_SCALE = 2;
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

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read image'));
    reader.readAsDataURL(blob);
  });
}

async function inlineImagesForCapture(el) {
  const imgs = Array.from(el.querySelectorAll('img'));
  await Promise.all(imgs.map(async (img) => {
    const src = img.currentSrc || img.getAttribute('src') || '';
    if (!src || src.startsWith('data:')) return;
    try {
      const res = await fetch(src);
      if (!res.ok) return;
      const blob = await res.blob();
      if (!String(blob.type || '').startsWith('image/')) return;
      const dataUrl = await blobToDataUrl(blob);
      img.removeAttribute('crossorigin');
      img.src = dataUrl;
    } catch {
      // keep original src — html2canvas may still capture it
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
    setTimeout(done, 8000);
  });
}

/**
 * Paint each photo into a 2× canvas using cover + top crop.
 * Baking at CSS size made html2canvas upscale a small JPEG and the share looked blurry.
 */
function bakeKeepRatioPhotos(el, scale = CAPTURE_SCALE) {
  const imgs = Array.from(el.querySelectorAll('img[data-keep-ratio]'));
  imgs.forEach((img) => {
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    const w = Math.round(img.clientWidth || img.width || 0);
    const h = Math.round(img.clientHeight || img.height || 0);
    if (!nw || !nh || w < 2 || h < 2) return;

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = FRAME_BG;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawImageCoverTop(ctx, img, canvas.width, canvas.height);
    img.removeAttribute('crossorigin');
    img.src = canvas.toDataURL('image/jpeg', 0.95);
    img.style.width = `${w}px`;
    img.style.height = `${h}px`;
    img.style.objectFit = 'fill';
    img.setAttribute('width', String(w));
    img.setAttribute('height', String(h));
  });
}

export async function captureTransformationCardAsBlob(el) {
  ensureShareCardFonts();
  if (document.fonts?.ready) {
    try {
      await document.fonts.ready;
      if (document.fonts.load) {
        await Promise.all([
          document.fonts.load('800 20px Poppins'),
          document.fonts.load('40px Pacifico'),
        ]);
      }
    } catch {
      // capture anyway — Arial / Segoe Script fallback still paints
    }
  }
  await inlineImagesForCapture(el);
  const cardImages = Array.from(el.querySelectorAll('img'));
  await Promise.all(cardImages.map(waitForImage));
  const photos = Array.from(el.querySelectorAll('img[data-keep-ratio]'));
  bakeKeepRatioPhotos(el, CAPTURE_SCALE);
  await Promise.all(photos.map(waitForImage));
  const html2canvas = (await import('html2canvas')).default;
  const canvas = await html2canvas(el, {
    useCORS: true,
    allowTaint: false,
    scale: CAPTURE_SCALE,
    backgroundColor: '#ffffff',
    logging: false,
    imageTimeout: 15000,
    foreignObjectRendering: false,
  });
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to create image from transformation card'));
    }, 'image/png');
  });
}

function transformationFileName(userName) {
  return `transformation-${String(userName || 'result').replace(/\s+/g, '-').toLowerCase()}.png`;
}

export async function shareTransformationCard(element, userName, _testimonial = null) {
  if (!element) throw new Error('Transformation card is not ready');
  const blob = await captureTransformationCardAsBlob(element);
  const dataUrl = await blobToDataUrl(blob);
  await shareImageDirectly(dataUrl, {
    title: 'My Wellness Transformation',
    text: '',
    fileName: transformationFileName(userName),
  });
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

function BrushLabel({ label, side }) {
  const color = side === 'left' ? BEFORE_BRUSH : AFTER_BRUSH;
  return (
    <div
      style={{
        position: 'absolute',
        left: '7%',
        right: '7%',
        bottom: 0,
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
          left: side === 'left' ? -7 : 25,
          right: side === 'left' ? 30 : -5,
          top: 35,
          height: 12,
          display: 'block',
          background: color,
          borderRadius: '65% 20% 70% 16%',
          transform: 'rotate(-5deg)',
          opacity: 0.65,
        }}
      />
      <p
        style={{
          position: 'relative',
          margin: 0,
          paddingTop: 16,
          fontFamily: SCRIPT_FONT,
          fontSize: 43,
          lineHeight: '58px',
          color: '#ffffff',
          textShadow: '0 2px 5px rgba(0,0,0,0.36)',
          transform: 'rotate(-3deg)',
        }}
      >
        {label}
      </p>
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
              src={src}
              alt={label}
              data-keep-ratio="1"
              crossOrigin="anonymous"
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
        }}
        >
          {label}
        </p>
        {weightKg > 0 && (
          <p style={{
            margin: '2px 0 0',
            textAlign: 'center',
            fontSize: 16,
            fontWeight: 800,
            color: '#111827',
            lineHeight: '20px',
          }}
          >
            {weightKg} kg
          </p>
        )}
      </div>
    </td>
  );
}

function HealthIssueChip({ label, padded = false }) {
  return (
    <td
      style={{
        verticalAlign: 'top',
        textAlign: 'center',
        padding: padded ? '10px 4px 0' : '0 4px',
        borderLeft: '1px solid #fbcfe8',
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          margin: '0 auto',
          borderRadius: 26,
          background: '#fce7f3',
          textAlign: 'center',
          lineHeight: '52px',
          fontSize: 26,
        }}
      >
        <span
          aria-hidden="true"
          style={{
            display: 'inline-block',
            width: 36,
            height: 36,
            lineHeight: '36px',
            fontSize: 27,
            textAlign: 'center',
            verticalAlign: 'middle',
          }}
        >
          {healthIssueShareIcon(label)}
        </span>
      </div>
      <p
        style={{
          margin: '6px auto 0',
          width: 92,
          fontSize: 11,
          fontWeight: 700,
          color: '#4b5563',
          lineHeight: '14px',
          textAlign: 'center',
        }}
      >
        {label}
      </p>
    </td>
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
  const diff = (bw > 0 && aw > 0) ? Math.abs(aw - bw).toFixed(1) : null;
  const isVerified = testimonial?.status === 'verified';
  const isLoss = testimonial?.goalType !== 'gain';
  const verb = isLoss ? 'Lost' : 'Gained';
  const issues = (testimonial?.recoveredHealthIssues ?? []).filter(Boolean).slice(0, MAX_VISIBLE_ISSUES);
  const durationText = testimonial?.durationText || '';
  const displayName = String(userName || 'Customer').trim() || 'Customer';
  const photoH = issues.length > 3
    ? PHOTO_H_MANY_ISSUES
    : issues.length > 0
      ? PHOTO_H_WITH_ISSUES
      : PHOTO_H_PLAIN;
  const issueRowA = issues.slice(0, 3);
  const issueRowB = issues.slice(3, 6);

  return (
    <div
      ref={ref}
      id="wv-transformation-share-card"
      style={{
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
                    src="/logo.png"
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
                  Wellness Valley
                  <span style={{ fontWeight: 500, fontSize: 13, color: '#d1fae5' }}>
                    {` (${getVersionString().replace(/\s+/g, '')})`}
                  </span>
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
          {diff ? (
            <tr>
              <td style={{ textAlign: 'center', padding: '10px 16px 0', verticalAlign: 'top' }}>
                <img
                  src={RESULT_BURST_LEFT_SRC}
                  alt=""
                  aria-hidden="true"
                  style={{
                    display: 'inline-block',
                    width: 38,
                    height: 28,
                    marginRight: 4,
                    verticalAlign: 'middle',
                  }}
                />
                <span
                  style={{
                    display: 'inline-block',
                    background: PILL_BG,
                    borderRadius: 22,
                    padding: '8px 22px',
                    lineHeight: '22px',
                    fontFamily: CARD_FONT,
                    fontSize: 17,
                    fontWeight: 800,
                    color: PILL_BLUE,
                    verticalAlign: 'middle',
                  }}
                >
                  {verb}
                  {' '}
                  {diff}
                  {' kgs'}
                  {durationText ? ` in ${durationText}` : ''}
                </span>
                <img
                  src={RESULT_BURST_RIGHT_SRC}
                  alt=""
                  aria-hidden="true"
                  style={{
                    display: 'inline-block',
                    width: 38,
                    height: 28,
                    marginLeft: 4,
                    verticalAlign: 'middle',
                  }}
                />
              </td>
            </tr>
          ) : null}
          {issues.length > 0 ? (
            <tr>
              <td style={{ padding: '10px 8px 18px', verticalAlign: 'top' }}>
                <div
                  style={{
                    background: '#fff1f2',
                    border: '1px solid #f9a8d4',
                    borderRadius: 16,
                    boxShadow: '0 2px 5px rgba(190, 24, 93, 0.15)',
                    padding: issueRowB.length > 0 ? '12px 8px' : '10px 8px',
                  }}
                >
                <table
                  style={{ width: '100%', borderCollapse: 'collapse' }}
                  cellPadding={0}
                  cellSpacing={0}
                >
                  <tbody>
                    <tr>
                      <td style={{ width: 176, verticalAlign: 'middle', padding: '0 8px' }}>
                        <p
                          style={{
                            margin: 0,
                            fontFamily: SCRIPT_FONT,
                            fontSize: 27,
                            lineHeight: '36px',
                            color: '#be185d',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          Health Issues
                        </p>
                        <p
                          style={{
                            margin: '2px 0 0',
                            fontSize: 11,
                            fontWeight: 500,
                            fontStyle: 'italic',
                            color: '#9ca3af',
                            lineHeight: '16px',
                          }}
                        >
                          while joining in
                          <br />
                          the community :
                        </p>
                      </td>
                      <td style={{ verticalAlign: 'middle' }}>
                        <table
                          style={{ width: '100%', borderCollapse: 'collapse' }}
                          cellPadding={0}
                          cellSpacing={0}
                        >
                          <tbody>
                            <tr>
                              {issueRowA.map((issue) => (
                                <HealthIssueChip key={issue} label={issue} />
                              ))}
                            </tr>
                            {issueRowB.length > 0 ? (
                              <tr>
                                {issueRowB.map((issue) => (
                                  <HealthIssueChip key={issue} label={issue} padded />
                                ))}
                              </tr>
                            ) : null}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  </tbody>
                </table>
                </div>
              </td>
            </tr>
          ) : (
            <tr>
              <td style={{ padding: '0 0 20px' }} />
            </tr>
          )}
        </tbody>
      </table>
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
 * Single Share button. kind="photo" shares the Before vs After card.
 * kind="video" shares the real Health/Business result videos.
 */
export function TransformationShareActions({
  kind = 'photo',
  cardRef,
  userName,
  testimonial = null,
  disabled = false,
  onBeforeAction,
}) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const isVideo = kind === 'video';

  useEffect(() => {
    if (!isVideo) void import('html2canvas');
  }, [isVideo]);

  const run = useCallback(async () => {
    if (disabled || busy) return;
    setBusy(true);
    setStatus(null);
    try {
      let resolved = testimonial;
      if (typeof onBeforeAction === 'function') {
        const detail = await onBeforeAction();
        if (detail) resolved = detail;
      }
      if (isVideo) {
        await shareResultVideos(resolved);
      } else {
        await shareTransformationCard(cardRef?.current, userName, resolved);
      }
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
  }, [busy, cardRef, disabled, isVideo, onBeforeAction, testimonial, userName]);

  return (
    <div className="space-y-1 pt-0.5">
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
