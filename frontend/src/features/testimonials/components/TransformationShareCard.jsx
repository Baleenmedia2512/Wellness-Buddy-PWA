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
 */
import React, { useRef, useState, useCallback, forwardRef, useEffect } from 'react';
import { X, Download, Share2, CheckCircle } from 'lucide-react';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';
import { captureAndShare } from '../../../shared/utils/shareUtils';
import { saveImageBlobToGallery } from '../../../shared/plugins/saveToGalleryPlugin';
import {
  shareResultVideos,
} from '../utils/downloadVideo.js';

const CARD_W = 360;
const PHOTO_H = 210;

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

export async function captureTransformationCardAsBlob(el) {
  await inlineImagesForCapture(el);
  const html2canvas = (await import('html2canvas')).default;
  const canvas = await html2canvas(el, {
    useCORS: true,
    allowTaint: false,
    scale: 2,
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

export async function shareTransformationCard(element, userName) {
  if (!element) throw new Error('Transformation card is not ready');
  await captureAndShare(element, {
    title: 'My Wellness Transformation',
    text: `${userName || 'Member'} · Wellness Valley Transformation`,
    fileName: transformationFileName(userName),
  });
}

export async function downloadTransformationCardImage(element, userName) {
  if (!element) throw new Error('Transformation card is not ready');
  const blob = await captureTransformationCardAsBlob(element);
  await saveImageBlobToGallery(blob, transformationFileName(userName));
}

function VerifiedTick() {
  return (
    <span
      style={{
        position: 'absolute',
        top: 8,
        left: 8,
        width: 26,
        height: 26,
        borderRadius: 13,
        background: '#16a34a',
        color: '#ffffff',
        fontSize: 16,
        fontWeight: 800,
        lineHeight: '26px',
        textAlign: 'center',
        boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
      }}
    >
      &#10003;
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
      <div style={side === 'left' ? { paddingRight: 4 } : { paddingLeft: 4 }}>
        <div style={{ position: 'relative' }}>
          {src ? (
            <img
              src={src}
              alt={label}
              crossOrigin="anonymous"
              style={{
                display: 'block',
                width: '100%',
                height: PHOTO_H,
                objectFit: 'cover',
                borderRadius: 12,
                objectPosition: 'top',
              }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: PHOTO_H,
                borderRadius: 12,
                background: '#f3f4f6',
              }}
            />
          )}
          {isVerified && src ? <VerifiedTick /> : null}
        </div>
        <p style={{
          margin: '8px 0 2px',
          textAlign: 'center',
          fontSize: 10,
          fontWeight: 700,
          color: '#9ca3af',
          letterSpacing: '1.2px',
          textTransform: 'uppercase',
        }}
        >
          {label}
        </p>
        {weightKg > 0 && (
          <p style={{
            margin: 0,
            textAlign: 'center',
            fontSize: 15,
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
  const accentBg = isLoss ? '#dcfce7' : '#dbeafe';
  const accentBdr = isLoss ? '#86efac' : '#93c5fd';
  const accentTxt = isLoss ? '#15803d' : '#1d4ed8';
  const issues = (testimonial?.recoveredHealthIssues ?? []).filter(Boolean);

  return (
    <div
      ref={ref}
      id="wv-transformation-share-card"
      style={{
        width: CARD_W,
        background: '#ffffff',
        borderRadius: 20,
        overflow: 'hidden',
        fontFamily: 'Arial, Helvetica, sans-serif',
      }}
    >
      <div style={{ background: '#059669', padding: '14px 20px' }}>
        <p style={{ margin: 0, color: '#ffffff', fontSize: 17, fontWeight: 800 }}>Wellness Valley</p>
        <p style={{ margin: '3px 0 0', color: '#d1fae5', fontSize: 11, fontWeight: 400 }}>Transformation Results</p>
      </div>

      <div style={{ paddingTop: 14, paddingBottom: 4, textAlign: 'center' }}>
        <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>{userName || 'Member'}</p>
      </div>

      {showPhotoRow && (
        <div style={{ padding: '8px 20px 12px' }}>
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

      {diff && (
        <div style={{ padding: '8px 20px 12px', textAlign: 'center' }}>
          <span style={{
            display: 'inline-block',
            background: accentBg,
            border: `2px solid ${accentBdr}`,
            borderRadius: 40,
            padding: '10px 28px',
            fontSize: 20,
            fontWeight: 800,
            lineHeight: '24px',
            color: accentTxt,
          }}
          >
            {verb} {diff} kgs{testimonial?.durationText ? ` in ${testimonial.durationText}` : ''}
          </span>
        </div>
      )}

      {issues.length > 0 && (
        <div style={{ padding: '4px 20px 16px', textAlign: 'center' }}>
          <p style={{
            margin: '0 0 8px',
            fontSize: 10,
            fontWeight: 700,
            color: '#9ca3af',
            textTransform: 'uppercase',
            letterSpacing: '1px',
          }}
          >
            Health Issues
          </p>
          {issues.map((issue) => (
            <span
              key={issue}
              style={{
                display: 'inline-block',
                margin: '0 4px 4px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: 20,
                padding: '5px 14px',
                fontSize: 12,
                fontWeight: 600,
                lineHeight: '16px',
                color: '#991b1b',
                textAlign: 'center',
              }}
            >
              {issue}
            </span>
          ))}
        </div>
      )}

      <div style={{ background: '#f9fafb', borderTop: '1px solid #e5e7eb', padding: '8px 20px', textAlign: 'center' }}>
        <p style={{ margin: 0, fontSize: 10, color: '#9ca3af' }}>wellness-valley.com &nbsp;·&nbsp; Powered by Wellness Valley</p>
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
        await shareTransformationCard(cardRef.current, userName);
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
        await shareTransformationCard(cardRef?.current, userName);
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
