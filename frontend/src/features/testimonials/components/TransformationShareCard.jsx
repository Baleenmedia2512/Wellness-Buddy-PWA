/**
 * TransformationShareCard.jsx
 * Pro shareable card: before/after photos + result + verified badge.
 * Uses html2canvas (already in package.json) for PNG capture.
 * Uses @capacitor/share for native share; Download saves to the device gallery.
 *
 * html2canvas compat rules applied throughout:
 *   - No flex/grid layout — uses table + block + margin:0 auto
 *   - No CSS gap — uses padding/margin
 *   - No inline-flex — inline-block for pills
 *   - No CSS gradients in html2canvas target area — solid colours only
 */
import React, { useRef, useState, useCallback } from 'react';
import { X, Download, Share2, CheckCircle } from 'lucide-react';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';
import { saveImageBlobToGallery } from '../../../shared/plugins/saveToGalleryPlugin';

async function captureCardAsBlob(el) {
  const html2canvas = (await import('html2canvas')).default;
  const canvas = await html2canvas(el, {
    useCORS:         true,
    allowTaint:      true,
    scale:           2,
    backgroundColor: '#ffffff',
    logging:         false,
    imageTimeout:    15000,
  });
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

async function shareOrDownload(blob, filename) {
  const { Share }                  = await import('@capacitor/share');
  const { Filesystem, Directory }  = await import('@capacitor/filesystem');
  const reader = new FileReader();
  const base64 = await new Promise((res, rej) => {
    reader.onload = () => res(reader.result.split(',')[1]);
    reader.onerror = () => rej(new Error('Failed to read image'));
    reader.readAsDataURL(blob);
  });
  const saved = await Filesystem.writeFile({ path: filename, data: base64, directory: Directory.Cache });
  await Share.share({ title: 'My Wellness Transformation', url: saved.uri });
}

// ─── Card rendering (html2canvas-safe) ───────────────────────────────────────

function TransformationCardContent({ testimonial, userName, hasAfter }) {
  const bw   = Number(testimonial?.beforeWeightKg ?? 0);
  const aw   = Number(testimonial?.afterWeightKg  ?? 0);
  const diff = (hasAfter && bw > 0 && aw > 0) ? Math.abs(aw - bw).toFixed(1) : null;

  const isVerified = testimonial?.status === 'verified';
  const isLoss     = testimonial?.goalType !== 'gain';
  const verb       = isLoss ? 'Lost' : 'Gained';
  const accentBg   = isLoss ? '#dcfce7' : '#dbeafe';
  const accentBdr  = isLoss ? '#86efac' : '#93c5fd';
  const accentTxt  = isLoss ? '#15803d' : '#1d4ed8';
  const issues     = (testimonial?.recoveredHealthIssues ?? []).slice(0, 5);

  const CARD_W    = 360;
  const PHOTO_H   = 210;

  return (
    <div id="wv-share-card" style={{ width: CARD_W, background: '#ffffff', borderRadius: 20, overflow: 'hidden', fontFamily: 'Arial, Helvetica, sans-serif' }}>

      {/* ── Header ── */}
      <div style={{ background: '#059669', padding: '14px 20px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }} cellPadding={0} cellSpacing={0}>
          <tbody><tr>
            <td style={{ verticalAlign: 'middle' }}>
              <p style={{ margin: 0, color: '#ffffff', fontSize: 17, fontWeight: 800 }}>Wellness Valley</p>
              <p style={{ margin: '3px 0 0', color: '#d1fae5', fontSize: 11, fontWeight: 400 }}>Transformation Results</p>
            </td>
            {isVerified && (
              <td style={{ verticalAlign: 'middle', textAlign: 'right' }}>
                <span style={{ display: 'inline-block', background: '#34d399', borderRadius: 20, padding: '4px 12px', color: '#ffffff', fontSize: 12, fontWeight: 700 }}>
                  &#10003; Verified
                </span>
              </td>
            )}
          </tr></tbody>
        </table>
      </div>

      {/* ── Member name ── */}
      <div style={{ paddingTop: 14, paddingBottom: 4, textAlign: 'center' }}>
        <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>{userName || 'Member'}</p>
      </div>

      {/* ── Photos ── */}
      {(testimonial?.beforeImageUrl || (hasAfter && testimonial?.afterImageUrl)) && (
        <div style={{ padding: '8px 14px 12px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }} cellPadding={0} cellSpacing={0}>
            <tbody><tr>
              <td style={{ width: '50%', verticalAlign: 'top', paddingRight: 4 }}>
                {testimonial?.beforeImageUrl && (
                  <div>
                    <img src={testimonial.beforeImageUrl} alt="Before" crossOrigin="anonymous"
                      style={{ display: 'block', width: '100%', height: PHOTO_H, objectFit: 'cover', borderRadius: 12, objectPosition: 'top' }} />
                    <p style={{ margin: '6px 0 1px', textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#9ca3af', letterSpacing: '1.2px', textTransform: 'uppercase' }}>BEFORE</p>
                    {bw > 0 && <p style={{ margin: 0, textAlign: 'center', fontSize: 15, fontWeight: 800, color: '#111827' }}>{bw} kg</p>}
                  </div>
                )}
              </td>
              <td style={{ width: '50%', verticalAlign: 'top', paddingLeft: 4 }}>
                {hasAfter && testimonial?.afterImageUrl && (
                  <div>
                    <img src={testimonial.afterImageUrl} alt="After" crossOrigin="anonymous"
                      style={{ display: 'block', width: '100%', height: PHOTO_H, objectFit: 'cover', borderRadius: 12, objectPosition: 'top' }} />
                    <p style={{ margin: '6px 0 1px', textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#9ca3af', letterSpacing: '1.2px', textTransform: 'uppercase' }}>AFTER</p>
                    {aw > 0 && <p style={{ margin: 0, textAlign: 'center', fontSize: 15, fontWeight: 800, color: '#111827' }}>{aw} kg</p>}
                  </div>
                )}
              </td>
            </tr></tbody>
          </table>
        </div>
      )}

      {/* ── Result pill ── */}
      {diff && (
        <div style={{ padding: '10px 20px 6px', textAlign: 'center' }}>
          <span style={{
            display:      'inline-block',
            background:   accentBg,
            border:       '2px solid ' + accentBdr,
            borderRadius: 40,
            padding:      '10px 28px',
            fontSize:     20,
            fontWeight:   800,
            color:        accentTxt,
          }}>
            {verb} {diff} kgs{testimonial?.durationText ? ' in ' + testimonial.durationText : ''}
          </span>
        </div>
      )}

      {/* ── Health issues ── */}
      {issues.length > 0 && (
        <div style={{ padding: '8px 20px 14px', textAlign: 'center' }}>
          <p style={{ margin: '0 0 5px', fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '1px' }}>Recovered From</p>
          {issues.map((issue) => (
            <span key={issue} style={{
              display:      'inline-block',
              margin:       '2px 3px',
              background:   '#fef2f2',
              border:       '1px solid #fecaca',
              borderRadius: 20,
              padding:      '3px 10px',
              fontSize:     11,
              fontWeight:   600,
              color:        '#991b1b',
            }}>
              {issue}
            </span>
          ))}
        </div>
      )}

      {/* ── Footer ── */}
      <div style={{ background: '#f9fafb', borderTop: '1px solid #e5e7eb', padding: '8px 20px', textAlign: 'center' }}>
        <p style={{ margin: 0, fontSize: 10, color: '#9ca3af' }}>wellness-valley.com &nbsp;·&nbsp; Powered by Wellness Valley</p>
      </div>
    </div>
  );
}

// ─── Modal wrapper ────────────────────────────────────────────────────────────

export default function TransformationShareCard({ testimonial, userName, hasAfter, onClose }) {
  const cardRef  = useRef(null);
  const [busy,   setBusy]   = useState(false);
  const [busyMode, setBusyMode] = useState(null);
  const [status, setStatus] = useState(null);

  const capture = useCallback(async (mode) => {
    if (!cardRef.current || busy) return;
    setBusy(true);
    setBusyMode(mode);
    setStatus(null);
    try {
      const blob     = await captureCardAsBlob(cardRef.current);
      const filename = `transformation-${String(userName || 'result').replace(/\s+/g, '-').toLowerCase()}.png`;
      if (mode === 'share') {
        await shareOrDownload(blob, filename);
        setStatus('shared');
      } else {
        await saveImageBlobToGallery(blob, filename);
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
          <div ref={cardRef}>
            <TransformationCardContent testimonial={testimonial} userName={userName} hasAfter={hasAfter} />
          </div>
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
          <p className="text-red-400 text-xs text-center">Could not save — please screenshot manually.</p>
        )}

        <div className="flex gap-3">
          <TouchFeedbackButton onClick={() => capture('download')} disabled={busy}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-white text-gray-800 text-sm font-bold shadow disabled:opacity-60">
            <Download className="h-4 w-4" /> {busyMode === 'download' ? 'Saving…' : 'Download'}
          </TouchFeedbackButton>
          <TouchFeedbackButton onClick={() => capture('share')} disabled={busy}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-green-500 text-white text-sm font-bold shadow disabled:opacity-60">
            <Share2 className="h-4 w-4" /> Share
          </TouchFeedbackButton>
        </div>

      </div>
    </div>
  );
}
