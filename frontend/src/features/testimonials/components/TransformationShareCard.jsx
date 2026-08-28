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
 *   - Never rely on object-fit at capture time — bake a cover-top bitmap first
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

const CARD_W = 360;
const PHOTO_H = 270;
const TICK_SIZE = 22;
const MAX_VISIBLE_ISSUES = 10;
const FRAME_BG = '#f3f4f6';
const CAPTURE_SCALE = 2;
const CARD_FONT = "'Poppins', Arial, Helvetica, sans-serif";

function ensurePoppinsFont() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('wv-poppins-font')) return;
  const link = document.createElement('link');
  link.id = 'wv-poppins-font';
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Poppins:wght@500;600;700;800&display=swap';
  document.head.appendChild(link);
}
ensurePoppinsFont();

const CHECK_MARK_SRC =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none">'
    + '<path d="M20 6L9 17l-5-5" stroke="#ffffff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>'
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
  ensurePoppinsFont();
  if (document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // capture anyway — Arial fallback still paints
    }
  }
  await inlineImagesForCapture(el);
  const photos = Array.from(el.querySelectorAll('img[data-keep-ratio]'));
  await Promise.all(photos.map(waitForImage));
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
        top: 6,
        left: 6,
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

function PhotoCell({ src, label, weightKg, isVerified, side }) {
  return (
    <td
      style={{
        width: '50%',
        verticalAlign: 'top',
        padding: 0,
      }}
    >
      <div style={side === 'left' ? { paddingRight: 3 } : { paddingLeft: 3 }}>
        <div style={{ position: 'relative' }}>
          {src ? (
            <img
              src={src}
              alt={label}
              data-keep-ratio="1"
              crossOrigin="anonymous"
              style={{
                display: 'block',
                width: '100%',
                height: PHOTO_H,
                objectFit: 'cover',
                borderRadius: 10,
                objectPosition: 'top',
              }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: PHOTO_H,
                borderRadius: 10,
                background: FRAME_BG,
              }}
            />
          )}
          {isVerified && src ? <VerifiedTick /> : null}
        </div>
        <p style={{
          margin: '3px 0 0',
          textAlign: 'center',
          fontSize: 9,
          fontWeight: 700,
          color: '#9ca3af',
          letterSpacing: '1.1px',
          textTransform: 'uppercase',
          lineHeight: '12px',
        }}
        >
          {label}
        </p>
        {weightKg > 0 && (
          <p style={{
            margin: '1px 0 0',
            textAlign: 'center',
            fontSize: 12,
            fontWeight: 800,
            color: '#111827',
            lineHeight: '15px',
          }}
          >
            {weightKg} kg
          </p>
        )}
      </div>
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

  return (
    <div
      ref={ref}
      id="wv-transformation-share-card"
      style={{
        width: CARD_W,
        background: '#ffffff',
        borderRadius: 20,
        overflow: 'hidden',
        fontFamily: CARD_FONT,
      }}
    >
      <div style={{ background: '#059669', padding: '5px 12px 6px' }}>
        <table
          style={{ width: '100%', borderCollapse: 'collapse' }}
          cellPadding={0}
          cellSpacing={0}
        >
          <tbody>
            <tr>
              <td style={{ width: 32, verticalAlign: 'middle', padding: 0, paddingRight: 8, lineHeight: 0 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    background: '#ffffff',
                    overflow: 'hidden',
                    textAlign: 'center',
                    lineHeight: '28px',
                  }}
                >
                  <img
                    src="/logo.png"
                    alt="Wellness Valley"
                    style={{
                      display: 'inline-block',
                      width: 22,
                      height: 22,
                      objectFit: 'contain',
                      verticalAlign: 'middle',
                    }}
                  />
                </div>
              </td>
              <td style={{ verticalAlign: 'middle', padding: 0, lineHeight: 0 }}>
                <p style={{ margin: 0, color: '#ffffff', fontSize: 15, fontWeight: 800, lineHeight: '20px' }}>
                  Wellness Valley
                  <span style={{ fontWeight: 500, fontSize: 11, color: '#d1fae5' }}>
                    {' '}( {getVersionString()} )
                  </span>
                </p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {showPhotoRow && (
        <div style={{ padding: '4px 8px 0' }}>
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
                  weightKg={bw}
                  isVerified={isVerified}
                  side="left"
                />
                <PhotoCell
                  src={afterSrc}
                  label="AFTER"
                  weightKg={aw}
                  isVerified={isVerified}
                  side="right"
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
          <tr>
            <td style={{ textAlign: 'center', padding: '6px 10px 6px', verticalAlign: 'top' }}>
              <p style={{
                margin: 0,
                lineHeight: '20px',
                fontFamily: CARD_FONT,
                whiteSpace: 'nowrap',
              }}
              >
                <span style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#4b5563',
                  textShadow: '0 0 6px #bbf7d0, 0 0 10px #86efac',
                }}
                >
                  {userName || 'Member'}
                </span>
                {diff ? (
                  <span>
                    <span style={{ color: '#d1d5db', padding: '0 6px' }}>·</span>
                    <span style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#4b5563',
                      textShadow: '0 0 6px #bbf7d0, 0 0 10px #86efac',
                    }}
                    >
                      {verb}
                      {' '}
                    </span>
                    <span style={{
                      fontSize: 14,
                      fontWeight: 800,
                      color: '#16a34a',
                      textShadow: '0 0 4px #ffffff, 0 0 8px #86efac, 0 0 12px #4ade80',
                    }}
                    >
                      {diff} kg
                    </span>
                    {durationText ? (
                      <span style={{
                        fontSize: 12,
                        fontWeight: 500,
                        color: '#6b7280',
                        textShadow: '0 0 6px #bbf7d0, 0 0 10px #86efac',
                      }}
                      >
                        {` in ${durationText}`}
                      </span>
                    ) : null}
                  </span>
                ) : null}
              </p>
            </td>
          </tr>
          {issues.length > 0 ? (
            <tr>
              <td style={{ textAlign: 'center', padding: '6px 12px 8px', verticalAlign: 'top' }}>
                <p style={{
                  margin: 0,
                  fontSize: 8,
                  fontWeight: 700,
                  color: '#9ca3af',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  lineHeight: '10px',
                  fontFamily: CARD_FONT,
                }}
                >
                  Health Issues
                </p>
                <p style={{
                  margin: '4px 0 0',
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#9f1239',
                  lineHeight: '16px',
                  fontFamily: CARD_FONT,
                }}
                >
                  {issues.map((issue, index) => (
                    <span key={issue}>
                      {index > 0 ? (
                        <span style={{ color: '#6b7280', fontWeight: 800, fontSize: 13 }}> · </span>
                      ) : null}
                      {issue}
                    </span>
                  ))}
                </p>
              </td>
            </tr>
          ) : (
            <tr>
              <td style={{ padding: '0 0 10px' }} />
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
      <div className="w-full max-w-[380px] space-y-4" onClick={(e) => e.stopPropagation()}>
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
