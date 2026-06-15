/**
 * UnknownCaptureUndoBanner.jsx — floating undo banner for unknown capture deletion.
 *
 * Renders a fixed-position amber banner at the bottom of the Diary screen
 * when an unknown capture is deleted. Shows countdown timer and Undo button.
 * Automatically expires and calls onExpire after UNDO_SECONDS.
 *
 * Pattern: Mirrors EducationUndoRow but adapted for shell-level floating banner.
 * Design: Matches Material Design snackbar undo pattern.
 */
import React, { useEffect, useState, useMemo } from 'react';
import { RotateCcw, HelpCircle } from 'lucide-react';

export const UNDO_SECONDS = 10;

const UnknownCaptureUndoBanner = ({
  captureId,
  userId,
  imageBase64,
  expiresAt,
  onUndo,
  onExpire,
}) => {
  const [now, setNow] = useState(Date.now());
  const [undoing, setUndoing] = useState(false);

  // Update countdown every 250ms
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(iv);
  }, []);

  // Auto-expire timer
  useEffect(() => {
    const ms = Math.max(0, expiresAt - Date.now());
    const timer = setTimeout(() => {
      if (!undoing) onExpire?.();
    }, ms);
    return () => clearTimeout(timer);
  }, [expiresAt, onExpire, undoing]);

  // Progress bar animation
  const { total, delayAtMount } = useMemo(() => {
    const t = Math.max(0, UNDO_SECONDS);
    const startedAt = expiresAt - t * 1000;
    const elapsed = Math.min(t, Math.max(0, (Date.now() - startedAt) / 1000));
    return { total: t, delayAtMount: -elapsed };
  }, [expiresAt]);

  const remaining = Math.ceil(Math.max(0, expiresAt - now) / 1000);

  const handleUndo = async () => {
    if (undoing) return;
    setUndoing(true);
    try {
      await onUndo?.({ captureId, userId });
    } catch (err) {
      console.error('[UnknownCaptureUndoBanner] Undo failed:', err);
      setUndoing(false);
    }
  };

  return (
    <div
      className="fixed bottom-20 left-4 right-4 z-50 pointer-events-auto"
      role="status"
      aria-live="polite"
      data-testid="unknown-capture-undo-banner"
    >
      <div className="bg-amber-50 border border-amber-200 rounded-xl shadow-lg p-3 flex items-center gap-3 relative overflow-hidden">
        {/* Icon */}
        <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
          <HelpCircle className="w-5 h-5 text-amber-700" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900">
            Capture deleted
          </p>
          <p className="text-xs text-amber-700">
            Undo available for {remaining}s
          </p>
        </div>

        {/* Undo Button */}
        <button
          type="button"
          disabled={undoing}
          onClick={handleUndo}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold ${
            undoing
              ? 'border-amber-300 bg-amber-50 text-amber-500 cursor-not-allowed'
              : 'border-amber-400 bg-white text-amber-800 hover:bg-amber-50 active:scale-95 transition-transform'
          }`}
          aria-label={undoing ? 'Restoring capture' : 'Undo delete'}
        >
          {undoing ? (
            <>
              <span
                className="inline-block h-4 w-4 rounded-full border-2 border-amber-400 border-t-transparent animate-spin"
                aria-hidden="true"
              />
              Restoring…
            </>
          ) : (
            <>
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
              Undo
            </>
          )}
        </button>

        {/* Progress bar */}
        <span
          className="absolute left-0 right-0 bottom-0 h-0.5 bg-amber-200 overflow-hidden rounded-b-xl"
          aria-hidden="true"
        >
          <span
            key={captureId}
            className="block h-full bg-amber-600 origin-left will-change-transform"
            style={{
              transformOrigin: 'left',
              animation: `countdown-shrink ${total}s linear ${delayAtMount}s forwards`,
            }}
          />
        </span>
      </div>

      <style>{`
        @keyframes countdown-shrink {
          from { transform: scaleX(1); }
          to { transform: scaleX(0); }
        }
      `}</style>
    </div>
  );
};

export default UnknownCaptureUndoBanner;
