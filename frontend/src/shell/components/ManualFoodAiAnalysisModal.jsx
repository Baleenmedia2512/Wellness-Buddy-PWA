/**
 * ManualFoodAiAnalysisModal — loading / error only.
 * Analysing/saving: full-screen dark background + food image + AI message
 * (same feel as the pre-share overlay). Success auto-saves to Home NutritionCard.
 */
import React, { useMemo } from 'react';
import { Loader2, Sparkles, X } from 'lucide-react';

function previewUrl(imageBase64) {
  if (!imageBase64) return null;
  return imageBase64.startsWith('data:')
    ? imageBase64
    : `data:image/jpeg;base64,${imageBase64}`;
}

/**
 * @param {{
 *   open: boolean,
 *   stage: 'analysing'|'failed'|'unidentified'|'saving',
 *   imageBase64: string|null,
 *   errorMessage?: string|null,
 *   onCancel: () => void,
 *   onRetry?: () => void,
 *   onManualLog?: () => void,
 * }} props
 */
export default function ManualFoodAiAnalysisModal({
  open,
  stage,
  imageBase64,
  errorMessage = null,
  onCancel,
  onRetry,
  onManualLog,
}) {
  const src = useMemo(() => previewUrl(imageBase64), [imageBase64]);

  if (!open) return null;

  const busy = stage === 'analysing' || stage === 'saving';

  // Full-screen dark overlay while AI runs / saves (image + message).
  if (busy) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="manual-ai-food-busy-title"
        aria-busy="true"
        className="fixed inset-0 z-[60] flex flex-col"
        style={{
          background: 'linear-gradient(160deg,#0a0a0a 0%,#111 100%)',
          padding: '16px 12px 28px',
        }}
      >
        <style>{`
          @keyframes _wb_ai_shimmer {
            0%   { transform: translateX(-120%) skewX(-18deg); }
            100% { transform: translateX(350%)  skewX(-18deg); }
          }
          @keyframes _wb_ai_dot {
            0%, 80%, 100% { transform: scale(0.55); opacity: 0.35; }
            40%           { transform: scale(1.05); opacity: 1; }
          }
        `}</style>

        <div className="flex shrink-0 items-center justify-between px-1 pt-[max(0.25rem,env(safe-area-inset-top))]">
          <p
            id="manual-ai-food-busy-title"
            className="text-sm font-semibold text-white/90"
          >
            {stage === 'saving' ? 'Saving your meal…' : 'AI food analysis'}
          </p>
          <button
            type="button"
            onClick={onCancel}
            disabled={stage === 'saving'}
            aria-label="Cancel"
            className="rounded-full p-2 text-white/70 hover:bg-white/10 disabled:opacity-40"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative mt-3 flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-2xl">
          {src ? (
            <img
              src={src}
              alt="Food being analysed"
              className="max-h-full max-w-full object-contain rounded-2xl"
            />
          ) : (
            <div className="flex h-48 w-full items-center justify-center rounded-2xl bg-white/5">
              <Loader2 className="h-10 w-10 animate-spin text-emerald-400" />
            </div>
          )}
          {src && (
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '45%',
                  height: '100%',
                  background:
                    'linear-gradient(90deg,transparent 0%,rgba(255,255,255,0.18) 50%,transparent 100%)',
                  animation: '_wb_ai_shimmer 1.7s ease-in-out infinite',
                }}
              />
            </div>
          )}
        </div>

        <div className="mt-5 flex shrink-0 flex-col items-center gap-3 px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2.5 backdrop-blur-sm ring-1 ring-white/15">
            <Sparkles className="h-4 w-4 text-amber-300" aria-hidden />
            <span className="text-sm font-semibold text-white">
              {stage === 'saving'
                ? 'Saving… results open on Home'
                : 'AI is analysing your food…'}
            </span>
            <span className="ml-1 flex gap-1" aria-hidden>
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400"
                  style={{
                    animation: '_wb_ai_dot 1.2s ease-in-out infinite',
                    animationDelay: `${i * 0.2}s`,
                  }}
                />
              ))}
            </span>
          </div>
          <p className="text-center text-xs text-white/55">
            {stage === 'saving'
              ? 'Almost done — nutrition will show on Home.'
              : 'Please wait. Do not close until analysis finishes.'}
          </p>
          {stage === 'analysing' && (
            <button
              type="button"
              onClick={onCancel}
              className="mt-1 rounded-xl border border-white/20 px-6 py-2.5 text-sm font-medium text-white/85 hover:bg-white/10"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    );
  }

  // Failed / unidentified — compact sheet with retry / manual log.
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="manual-ai-food-title"
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/80 sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel?.();
      }}
    >
      <div
        className="flex w-full max-w-md max-h-[92vh] flex-col overflow-hidden rounded-t-3xl bg-white shadow-xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h2 id="manual-ai-food-title" className="text-base font-semibold text-gray-900">
            {stage === 'failed' && 'Analysis failed'}
            {stage === 'unidentified' && 'Food not identified'}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {src && (
            <img
              src={src}
              alt="Selected food"
              className="w-full max-h-48 rounded-xl object-cover bg-gray-100"
            />
          )}

          {stage === 'failed' && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 space-y-1">
              <p className="font-medium">Unable to analyse this food image.</p>
              <p>
                {errorMessage
                  ? errorMessage.replace(' Please try again later.', '') 
                  : 'An unexpected error occurred.'}
              </p>
              <p>Please try again later or log the food manually.</p>
            </div>
          )}

          {stage === 'unidentified' && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 space-y-1">
              <p className="font-medium">We couldn&apos;t identify the food in this image.</p>
              <p>Please try another image or log the food manually.</p>
            </div>
          )}
        </div>

        <div className="border-t border-gray-100 px-4 py-3 flex gap-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="flex-1 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
            >
              Retry
            </button>
          )}
          <button
            type="button"
            onClick={onManualLog}
            className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white"
          >
            Log manually
          </button>
        </div>
      </div>
    </div>
  );
}
