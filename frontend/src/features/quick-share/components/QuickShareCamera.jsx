/**
 * frontend/src/features/quick-share/components/QuickShareCamera.jsx
 * ---------------------------------------------------------------------------
 * Fullscreen overlay rendered when the camera-first flow is active.
 *
 * Props:
 *   phase         — CapturePhase from useQuickShareEntry
 *   capturedDataUrl — data URL of the photo taken, or null
 *   imageType     — 'weight'|'food'|null
 *   viewUrl       — backend public link, or null
 *   errorMsg      — error string, or empty
 *   onCapture     — () => void   trigger camera
 *   onShare       — () => void   trigger WhatsApp share
 *   onDismiss     — () => void   close without sharing (→ Home)
 * ---------------------------------------------------------------------------
 */
import React from 'react';
import { Camera, Share2, X } from 'lucide-react';
import LoadingSpinner from '../../../shared/components/LoadingSpinner.js';

const PHASE_LABEL = {
  idle: '',
  capturing: 'Opening camera…',
  detecting: 'Analysing photo…',
  posting: 'Preparing share…',
  share_ready: '',
  sharing: 'Sharing…',
  done: '',
  error: '',
};

export default function QuickShareCamera({
  phase,
  capturedDataUrl,
  imageType,
  viewUrl,
  errorMsg,
  onCapture,
  onShare,
  onDismiss,
}) {
  const isLoading = phase === 'detecting' || phase === 'posting' || phase === 'sharing';
  const isCaptured = !!capturedDataUrl;
  const canShare = phase === 'share_ready';

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black"
      style={{ touchAction: 'manipulation' }}
    >
      {/* Close button */}
      <button
        onClick={onDismiss}
        className="absolute top-4 right-4 p-2 rounded-full bg-white/20 text-white"
        aria-label="Close camera"
      >
        <X size={24} />
      </button>

      {/* Photo preview */}
      {isCaptured ? (
        <img
          src={capturedDataUrl}
          alt="Captured"
          className="w-full max-h-[60vh] object-contain"
        />
      ) : (
        <div className="flex flex-col items-center justify-center gap-4 text-white opacity-60">
          <Camera size={64} />
          <p className="text-lg font-medium">Tap to capture</p>
        </div>
      )}

      {/* Status label */}
      {PHASE_LABEL[phase] ? (
        <p className="mt-4 text-white text-sm opacity-75">{PHASE_LABEL[phase]}</p>
      ) : null}

      {/* Loading spinner */}
      {isLoading && (
        <div className="mt-4">
          <LoadingSpinner size="sm" />
        </div>
      )}

      {/* Error message */}
      {phase === 'error' && errorMsg ? (
        <p className="mt-4 px-6 text-center text-red-400 text-sm">{errorMsg}</p>
      ) : null}

      {/* Analysis link badge (shown when background analysis is pending or done) */}
      {canShare && viewUrl && imageType !== 'weight' && (
        <p className="mt-2 px-4 text-center text-green-300 text-xs">
          Nutrition analysis link ready ✓
        </p>
      )}

      {/* Action buttons */}
      <div className="mt-6 flex flex-col items-center gap-3 w-full px-8">
        {/* Capture button — only before a photo is taken */}
        {!isCaptured && phase !== 'detecting' && phase !== 'posting' && (
          <button
            onClick={onCapture}
            className="w-full py-4 rounded-2xl bg-white text-black font-semibold text-lg flex items-center justify-center gap-2 active:scale-95 transition-transform"
          >
            <Camera size={20} />
            Take Photo
          </button>
        )}

        {/* Share button — shown once share_ready */}
        {canShare && (
          <button
            onClick={onShare}
            className="w-full py-4 rounded-2xl bg-green-500 text-white font-semibold text-lg flex items-center justify-center gap-2 active:scale-95 transition-transform"
          >
            <Share2 size={20} />
            Share on WhatsApp
          </button>
        )}

        {/* Retry after error */}
        {phase === 'error' && (
          <button
            onClick={onCapture}
            className="w-full py-4 rounded-2xl bg-white text-black font-semibold text-lg active:scale-95 transition-transform"
          >
            Try Again
          </button>
        )}

        {/* Skip / Go to Home */}
        <button
          onClick={onDismiss}
          className="text-white/60 text-sm py-2"
        >
          Go to Home
        </button>
      </div>
    </div>
  );
}
