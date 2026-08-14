/**
 * TransformationShareCard.jsx
 * Clean standalone Transformation card for share/download.
 *
 * Mirrors the Diary Food Card pattern:
 *   - Off-screen (or hidden) card is captured with html2canvas
 *   - Share uses shared captureAndShare (same pipeline as Diary)
 *   - Download Image saves the captured card, never a page screenshot
 *
 * html2canvas compat rules:
 *   - No flex/grid — table + block + margin:0 auto
 *   - No CSS gap — padding/margin
 *   - No inline-flex — inline-block for pills
 *   - No CSS gradients in the capture target — solid colours only
 */
import React, { useRef, useState, useCallback, forwardRef } from 'react';
import { X, Download, Share2, CheckCircle } from 'lucide-react';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';
import { captureAndShare } from '../../../shared/utils/shareUtils';
import { saveImageBlobToGallery } from '../../../shared/plugins/saveToGalleryPlugin';
import { downloadVideoFromUrl, resolveResultVideoUrl } from '../utils/downloadVideo.js';

const CARD_W = 360;
const PHOTO_H = 210;

export async function captureTransformationCardAsBlob(el) {
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

function PhotoCell({ src, label, weightKg, isVerified, pad }) {
  if (!src) return null;
  return (
    <td style={{ width: '50%', verticalAlign: 'top', ...pad }}>
      <div style={{ position: 'relative' }}>
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
        {isVerified ? <VerifiedTick /> : null}
      </div>
      <p style={{
        margin: '6px 0 1px',
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
        <p style={{ margin: 0, textAlign: 'center', fontSize: 15, fontWeight: 800, color: '#111827' }}>
          {weightKg} kg
        </p>
      )}
    </td>
  );
}

/**
 * Standalone transformation card — capture this element, never the page.
 */
export const TransformationCardContent = forwardRef(function TransformationCardContent(
  { testimonial, userName, hasAfter, videoThumbnailUrl },
  ref,
) {
  const bw = Number(testimonial?.beforeWeightKg ?? 0);
  const aw = Number(testimonial?.afterWeightKg ?? 0);
  const diff = (hasAfter && bw > 0 && aw > 0) ? Math.abs(aw - bw).toFixed(1) : null;
  const isVerified = testimonial?.status === 'verified';
  const isLoss = testimonial?.goalType !== 'gain';
  const verb = isLoss ? 'Lost' : 'Gained';
  const accentBg = isLoss ? '#dcfce7' : '#dbeafe';
  const accentBdr = isLoss ? '#86efac' : '#93c5fd';
  const accentTxt = isLoss ? '#15803d' : '#1d4ed8';
  const issues = (testimonial?.recoveredHealthIssues ?? []).filter(Boolean);
  const hasVideo = Boolean(
    testimonial?.healthVideoUrl || testimonial?.businessVideoUrl || videoThumbnailUrl,
  );

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

      {(testimonial?.beforeImageUrl || (hasAfter && testimonial?.afterImageUrl)) && (
        <div style={{ padding: '8px 14px 12px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }} cellPadding={0} cellSpacing={0}>
            <tbody>
              <tr>
                <PhotoCell
                  src={testimonial?.beforeImageUrl}
                  label="BEFORE"
                  weightKg={bw}
                  isVerified={isVerified}
                  pad={{ paddingRight: 4 }}
                />
                <PhotoCell
                  src={hasAfter ? testimonial?.afterImageUrl : null}
                  label="AFTER"
                  weightKg={aw}
                  isVerified={isVerified}
                  pad={{ paddingLeft: 4 }}
                />
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {diff && (
        <div style={{ padding: '6px 20px 10px', textAlign: 'center' }}>
          <span style={{
            display: 'inline-block',
            background: accentBg,
            border: `2px solid ${accentBdr}`,
            borderRadius: 40,
            padding: '10px 28px',
            fontSize: 20,
            fontWeight: 800,
            color: accentTxt,
          }}
          >
            {verb} {diff} kgs{testimonial?.durationText ? ` in ${testimonial.durationText}` : ''}
          </span>
        </div>
      )}

      <div style={{ padding: '4px 20px 14px', textAlign: 'center' }}>
        <p style={{
          margin: '0 0 6px',
          fontSize: 10,
          fontWeight: 700,
          color: '#9ca3af',
          textTransform: 'uppercase',
          letterSpacing: '1px',
        }}
        >
          Recovery Health Issue
        </p>
        {issues.length > 0 ? issues.map((issue) => (
          <span
            key={issue}
            style={{
              display: 'inline-block',
              margin: '2px 3px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 20,
              padding: '4px 12px',
              fontSize: 12,
              fontWeight: 600,
              color: '#991b1b',
            }}
          >
            {issue}
          </span>
        )) : (
          <p style={{ margin: 0, fontSize: 12, color: '#9ca3af' }}>Not added yet</p>
        )}
      </div>

      {hasVideo && (
        <div style={{ padding: '0 14px 14px' }}>
          <p style={{
            margin: '0 0 6px',
            textAlign: 'center',
            fontSize: 10,
            fontWeight: 700,
            color: '#9ca3af',
            textTransform: 'uppercase',
            letterSpacing: '1px',
          }}
          >
            Result Video
          </p>
          <div style={{
            position: 'relative',
            height: 160,
            borderRadius: 12,
            overflow: 'hidden',
            background: '#111827',
          }}
          >
            {videoThumbnailUrl ? (
              <img
                src={videoThumbnailUrl}
                alt="Result video"
                crossOrigin="anonymous"
                style={{ display: 'block', width: '100%', height: 160, objectFit: 'cover' }}
              />
            ) : null}
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: 44,
              height: 44,
              marginTop: -22,
              marginLeft: -22,
              borderRadius: 22,
              background: '#16a34a',
              color: '#ffffff',
              fontSize: 18,
              fontWeight: 800,
              lineHeight: '44px',
              textAlign: 'center',
            }}
            >
              ▶
            </div>
          </div>
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
  }, [busy, userName]);

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
            hasAfter={hasAfter}
            videoThumbnailUrl={videoThumbnailUrl}
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
 * Inline Share / Download Image / Download Video actions.
 * Captures the off-screen Transformation card (Diary Food Card pattern).
 */
export function TransformationShareActions({
  cardRef,
  userName,
  videoUrl,
  hasVideo = Boolean(videoUrl),
  disabled = false,
  onBeforeAction,
}) {
  const [busy, setBusy] = useState(null);
  const [status, setStatus] = useState(null);

  const run = useCallback(async (mode) => {
    if (disabled || busy) return;
    setBusy(mode);
    setStatus(null);
    try {
      let resolvedVideoUrl = videoUrl;
      if (typeof onBeforeAction === 'function') {
        const detail = await onBeforeAction();
        resolvedVideoUrl = resolveResultVideoUrl(detail) || videoUrl;
      }
      if (mode === 'share') {
        await shareTransformationCard(cardRef?.current, userName);
        setStatus('shared');
      } else if (mode === 'image') {
        await downloadTransformationCardImage(cardRef?.current, userName);
        setStatus('saved');
      } else if (mode === 'video') {
        const safe = String(userName || 'result').replace(/\s+/g, '-').toLowerCase();
        await downloadVideoFromUrl(resolvedVideoUrl, `transformation-video-${safe}`);
        setStatus('video');
      }
    } catch {
      setStatus('error');
    } finally {
      setBusy(null);
    }
  }, [busy, cardRef, disabled, onBeforeAction, userName, videoUrl, hasVideo]);

  return (
    <div className="space-y-2 pt-1">
      <div className="grid grid-cols-3 gap-2">
        <TouchFeedbackButton
          onClick={() => run('share')}
          disabled={disabled || Boolean(busy)}
          className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl bg-green-600 text-white text-[11px] font-bold disabled:opacity-60"
        >
          <Share2 className="h-4 w-4" />
          {busy === 'share' ? 'Sharing…' : 'Share'}
        </TouchFeedbackButton>
        <TouchFeedbackButton
          onClick={() => run('image')}
          disabled={disabled || Boolean(busy)}
          className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-800 text-[11px] font-bold disabled:opacity-60"
        >
          <Download className="h-4 w-4" />
          {busy === 'image' ? 'Saving…' : 'Download Image'}
        </TouchFeedbackButton>
        <TouchFeedbackButton
          onClick={() => run('video')}
          disabled={disabled || Boolean(busy) || !hasVideo}
          className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-800 text-[11px] font-bold disabled:opacity-60"
        >
          <Download className="h-4 w-4" />
          {busy === 'video' ? 'Saving…' : 'Download Video'}
        </TouchFeedbackButton>
      </div>
      {status === 'saved' && (
        <p className="text-[11px] text-green-700 text-center font-semibold">Transformation card saved</p>
      )}
      {status === 'shared' && (
        <p className="text-[11px] text-green-700 text-center font-semibold">Ready to share</p>
      )}
      {status === 'video' && (
        <p className="text-[11px] text-green-700 text-center font-semibold">Result video downloaded</p>
      )}
      {status === 'error' && (
        <p className="text-[11px] text-red-600 text-center">Could not complete that action. Please try again.</p>
      )}
    </div>
  );
}
