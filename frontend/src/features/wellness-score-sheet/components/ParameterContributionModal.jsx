import React from 'react';
import { Loader2, X } from 'lucide-react';

/**
 * Bottom sheet — same interaction pattern as nutrition FoodBreakdownModal.
 * Shows how a wellness parameter earned its points + contributing foods/logs.
 */
export default function ParameterContributionModal({
  isOpen,
  onClose,
  view = null,
  loading = false,
  error = null,
}) {
  if (!isOpen || !view) return null;

  const {
    title,
    earnedPoints,
    maxPoints,
    percentage,
    calculationReason,
    listLabel,
    emptyHint,
    unit,
    totalConsumed,
    decimals = 0,
    breakdown = [],
    showAmountPercent = true,
    amountIsLabel = false,
  } = view;

  const formatAmount = (amount, amountLabel) => {
    if (amountIsLabel && amountLabel) return amountLabel;
    if (amountIsLabel) return `${Math.round(amount)}`;
    const n = Number(amount) || 0;
    const formatted = decimals > 0 ? n.toFixed(decimals) : String(Math.round(n));
    return unit ? `${formatted}${unit}` : formatted;
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[60] bg-black/40"
        onClick={onClose}
        style={{ animation: 'wsFadeIn 0.2s ease-out' }}
        aria-hidden
      />

      <div
        className="fixed bottom-0 left-0 right-0 z-[61] flex max-h-[75vh] flex-col rounded-t-3xl bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label={`${title} contribution`}
        onClick={(e) => e.stopPropagation()}
        style={{ animation: 'wsSlideUp 0.3s ease-out' }}
      >
        <div className="flex items-start justify-between border-b border-gray-200 px-4 py-3">
          <div className="min-w-0 pr-3">
            <h2 className="text-lg font-bold text-gray-900">{title}</h2>
            <div className="mt-0.5 flex flex-wrap items-baseline gap-2">
              <span className="text-sm text-gray-600">
                {earnedPoints}/{maxPoints} pts
              </span>
              <span
                className={`text-xs font-semibold ${
                  percentage >= 100 ? 'text-emerald-600' : percentage > 0 ? 'text-amber-600' : 'text-gray-500'
                }`}
              >
                {percentage}% of max
              </span>
              {totalConsumed != null && unit && (
                <span className="text-xs text-gray-500">
                  · {formatAmount(totalConsumed)} total
                </span>
              )}
            </div>
            {calculationReason && (
              <p className="mt-1 text-[11px] font-medium leading-snug text-gray-700">
                {calculationReason}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 transition-colors hover:bg-gray-100"
            aria-label="Close"
          >
            <X className="h-5 w-5 text-gray-600" />
          </button>
        </div>

        <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-2">
          <span className="text-xs font-semibold text-gray-700">{listLabel}</span>
          {showAmountPercent && !amountIsLabel && (
            <span className="text-xs text-gray-500">% of total</span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-2">
          {loading && (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-emerald-600" aria-label="Loading contributions" />
            </div>
          )}

          {!loading && error && (
            <div className="py-8 text-center">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {!loading && !error && breakdown.length === 0 && (
            <div className="py-8 text-center">
              <p className="text-sm text-gray-500">{emptyHint}</p>
            </div>
          )}

          {!loading && !error && breakdown.length > 0 && (
            <div className="space-y-0.5">
              {breakdown.map((item, index) => (
                <div
                  key={`${item.foodName}-${index}`}
                  className="flex items-center justify-between border-b border-gray-100 py-2.5 last:border-0"
                >
                  <div className="min-w-0 flex-1 pr-3">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {item.foodName}
                    </p>
                    {item.detail && (
                      <p className="mt-0.5 text-[11px] text-gray-500">{item.detail}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="whitespace-nowrap font-semibold text-gray-900">
                      {formatAmount(item.amount, item.amountLabel)}
                    </span>
                    {showAmountPercent && (
                      <span className="w-10 text-right text-gray-500">
                        {Math.round(item.percentage || 0)}%
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 bg-gray-50 px-4 py-3">
          <div className="flex items-center justify-between text-xs">
            <div className="text-center">
              <p className="mb-0.5 text-gray-500">Max</p>
              <p className="font-semibold text-gray-900">{maxPoints} pts</p>
            </div>
            <div className="text-center">
              <p className="mb-0.5 text-gray-500">Earned</p>
              <p className="font-semibold text-emerald-600">{earnedPoints} pts</p>
            </div>
            <div className="text-center">
              <p className="mb-0.5 text-gray-500">Score</p>
              <p className="font-semibold text-gray-900">{percentage}%</p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes wsFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes wsSlideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </>
  );
}
