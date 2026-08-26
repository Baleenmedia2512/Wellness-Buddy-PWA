/**
 * ManualFoodAiAnalysisModal — loading / error only.
 * Successful AI food results auto-save and show on Home (NutritionCard).
 */
import React, { useMemo } from 'react';
import { Loader2, X } from 'lucide-react';

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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="manual-ai-food-title"
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/80 sm:items-center"
      onClick={(e) => {
        if (busy) return;
        if (e.target === e.currentTarget) onCancel?.();
      }}
    >
      <div
        className="flex w-full max-w-md max-h-[92vh] flex-col overflow-hidden rounded-t-3xl bg-white shadow-xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h2 id="manual-ai-food-title" className="text-base font-semibold text-gray-900">
            {stage === 'analysing' && 'Analysing your food…'}
            {stage === 'saving' && 'Saving…'}
            {stage === 'failed' && 'Analysis failed'}
            {stage === 'unidentified' && 'Food not identified'}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            disabled={busy}
            className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 disabled:opacity-40"
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

          {(stage === 'analysing' || stage === 'saving') && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <Loader2 className="h-10 w-10 animate-spin text-emerald-600" aria-hidden />
              <p className="text-sm font-medium text-gray-800">
                {stage === 'saving' ? 'Saving to your diary…' : 'Analysing your food…'}
              </p>
              <p className="text-xs text-gray-500">
                {stage === 'saving'
                  ? 'Results will open on Home.'
                  : 'This may take a moment. Please keep this open.'}
              </p>
            </div>
          )}

          {stage === 'failed' && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 space-y-1">
              <p className="font-medium">Unable to analyse this food image.</p>
              <p>{errorMessage || 'Please try again or log the food manually.'}</p>
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
          {busy && (
            <button
              type="button"
              onClick={onCancel}
              disabled={stage === 'saving'}
              className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
            >
              Cancel
            </button>
          )}

          {(stage === 'failed' || stage === 'unidentified') && (
            <>
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
