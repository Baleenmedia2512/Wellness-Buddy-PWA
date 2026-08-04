/**
 * WeightProgressTipsModal.jsx
 *
 * Pure presentation layer for weight-progress insights.
 * All reasoning lives in services/weightInsightEngine.js.
 */
import React, { useMemo } from 'react';
import { X, AlertCircle, CheckCircle, TrendingUp, TrendingDown } from 'lucide-react';
import {
  generateWeightInsightsFromComparison,
  determineWeightDirection,
  INSIGHT_DISCLAIMER,
} from '../services/weightInsightEngine.js';

// ─── Display helpers (presentation only) ─────────────────────────────────────

const ANALYSIS_GRID_CLASS =
  'grid w-full min-w-0 grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_auto_minmax(0,1.05fr)] gap-x-1 xs:gap-x-1.5 sm:gap-x-2 items-center';

/** >= 1000 ml → liters; below → ml */
function formatWaterDisplay(value) {
  const num = value ?? 0;
  if (num >= 1000) {
    return {
      display: (num / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 }),
      unit: 'L',
    };
  }
  return { display: Math.round(num).toLocaleString(), unit: 'ml' };
}

const DISPLAY_VARIANT_CLASS = {
  surplus: 'text-red-600',
  deficit: 'text-orange-600',
  positive: 'text-green-600',
};

function formatConsumedTarget(reason) {
  const consumedNum = reason.consumed ?? 0;
  const target = reason.target;
  const hasTarget = target != null && Number.isFinite(target) && target > 0;

  if (reason.formatType === 'water') {
    const consumedFmt = formatWaterDisplay(consumedNum);
    const targetFmt = hasTarget ? formatWaterDisplay(target) : null;
    return {
      consumedDisplay: consumedFmt.display,
      targetDisplay: targetFmt ? targetFmt.display : '—',
      targetUnit: targetFmt ? targetFmt.unit : reason.unit,
      hasTarget,
    };
  }

  return {
    consumedDisplay: Math.round(consumedNum).toLocaleString(),
    targetDisplay: hasTarget ? Math.round(target).toLocaleString() : '—',
    targetUnit: reason.unit,
    hasTarget,
  };
}

function AnalysisHeader() {
  return (
    <div className={`${ANALYSIS_GRID_CLASS} pt-2 pb-1`}>
      <span aria-hidden="true" />
      <span className="text-[10px] xs:text-xs font-medium text-gray-500 text-right leading-tight">
        Consumed
      </span>
      <span className="text-[10px] xs:text-xs font-medium text-gray-500 text-center px-0.5 xs:px-1 leading-tight">
        vs
      </span>
      <span className="text-[10px] xs:text-xs font-medium text-gray-500 text-right leading-tight">
        Target
      </span>
    </div>
  );
}

/** Renders a single engine reason — no business logic */
function AnalysisReasonRow({ reason }) {
  const { consumedDisplay, targetDisplay, targetUnit, hasTarget } = formatConsumedTarget(reason);
  const consumedClass = DISPLAY_VARIANT_CLASS[reason.displayVariant] || 'text-gray-700';

  return (
    <div className={`${ANALYSIS_GRID_CLASS} py-2 xs:py-2.5 sm:py-3 border-b border-gray-100 last:border-0`}>
      <span className="flex items-center gap-0.5 xs:gap-1 text-[11px] xs:text-xs sm:text-sm font-semibold text-gray-700 min-w-0">
        {reason.icon && <span className="shrink-0 text-xs xs:text-sm">{reason.icon}</span>}
        <span className="truncate min-w-0">{reason.label}</span>
      </span>
      <strong
        className={`${consumedClass} text-xs xs:text-sm sm:text-base font-bold text-right tabular-nums leading-tight min-w-0 truncate`}
      >
        {consumedDisplay}
      </strong>
      <span className="text-gray-400 font-medium text-[10px] xs:text-xs text-center px-0.5 xs:px-1 shrink-0">
        vs
      </span>
      <span className="min-w-0 text-right leading-tight">
        <strong className="text-gray-700 text-xs xs:text-sm sm:text-base font-bold tabular-nums">
          {targetDisplay}
        </strong>
        {hasTarget && targetUnit && (
          <span className="text-gray-500 text-[10px] xs:text-xs ml-0.5 xs:ml-1">{targetUnit}</span>
        )}
      </span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function WeightProgressTipsModal({
  isOpen,
  onClose,
  onOpenGallery,
  comparison,
  goalMode,
  userName,
  followedPlanCorrectly = false,
  coachPhone = null,
}) {
  const insight = useMemo(
    () => generateWeightInsightsFromComparison(comparison, goalMode),
    [comparison, goalMode]
  );

  if (!isOpen || !comparison) return null;

  const isFirstUpload = insight.status === 'first_upload';
  const displayName = userName || 'there';
  const goalLabel =
    insight.goal === 'loss' ? 'Weight Loss'
    : insight.goal === 'gain' ? 'Weight Gain'
    : 'Weight Management';

  const prevWeight = comparison.weight?.previous;
  const currWeight = comparison.weight?.current;
  const weightDirection = determineWeightDirection(prevWeight, currWeight);
  const weightWentUp = weightDirection === 'up';
  const weightWentDown = weightDirection === 'down';

  const explanation = isFirstUpload
    ? `Welcome! Your starting weight is ${currWeight} kg. Let's begin your ${goalLabel.toLowerCase()} journey!`
    : followedPlanCorrectly
    ? `You followed your plan correctly, but your weight increased. Please contact your sponsor for guidance.`
    : weightWentUp
    ? `Your weight is higher than your previous weight.`
    : weightWentDown
    ? `Your weight is lower than your previous weight.`
    : `Your weight is unchanged from your previous reading.`;

  const handleContactCoach = () => {
    if (coachPhone) {
      window.open(`tel:${coachPhone}`, '_system');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 px-4 py-4">
      <div
        className="relative w-full max-w-lg max-h-[92vh] overflow-y-auto overflow-x-hidden bg-white rounded-2xl shadow-2xl flex flex-col"
        style={{ maxWidth: 'min(32rem, calc(100vw - 2rem))' }}
      >
        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="sticky top-0 z-10 bg-gradient-to-r from-green-500 to-teal-500 text-white p-6 rounded-t-2xl">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-full transition"
            aria-label="Close"
          >
            <X size={22} />
          </button>

          <div className="flex items-start gap-3 pr-10">
            {isFirstUpload ? (
              <CheckCircle size={32} className="shrink-0 mt-0.5" />
            ) : (
              <AlertCircle size={32} className="shrink-0 mt-0.5" />
            )}
            <div>
              <h2 className="text-xl font-bold leading-tight">
                {isFirstUpload ? '🎉 Welcome to Your Journey!' : 'Weight Update'}
              </h2>
              <p className="text-sm opacity-90 mt-0.5">
                Hello, <strong>{displayName}</strong>
              </p>
              <p className="text-sm opacity-90">
                Your Goal: <strong>{goalLabel}</strong>
              </p>
            </div>
          </div>
        </div>

        {/* ── Body ─────────────────────────────────────────────────────── */}
        <div className="flex-1 p-4 xs:p-5 sm:p-6 space-y-4 xs:space-y-5 sm:space-y-6">
          {!isFirstUpload && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="text-center">
                  <p className="text-xs text-gray-500 mb-1">Previous</p>
                  <p className="text-2xl font-bold text-gray-800">{prevWeight} kg</p>
                </div>
                <div className="flex flex-col items-center">
                  {weightWentUp ? (
                    <TrendingUp className="text-red-500" size={28} />
                  ) : weightWentDown ? (
                    <TrendingDown className="text-green-500" size={28} />
                  ) : (
                    <span className="text-gray-500 text-2xl font-bold">→</span>
                  )}
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500 mb-1">Today</p>
                  <p className="text-2xl font-bold text-orange-600">{currWeight} kg</p>
                </div>
              </div>
              <p className="text-sm text-gray-700 mt-3 text-center font-medium">{explanation}</p>
            </div>
          )}

          {isFirstUpload && (
            <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 text-center">
              <p className="text-xs text-gray-500 mb-1">Starting Weight</p>
              <p className="text-4xl font-bold text-teal-600">{currWeight} kg</p>
              <p className="text-sm text-gray-600 mt-2">{explanation}</p>
            </div>
          )}

          {!isFirstUpload && insight.sectionTitle && (
            <section>
              <h3 className="text-base font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <span>📊</span>
                {insight.sectionTitle}
              </h3>
              <div className="bg-gray-50 rounded-xl px-2 xs:px-3 sm:px-4 py-1 divide-y divide-gray-100 min-w-0">
                {insight.reasons.length > 0 ? (
                  <>
                    <AnalysisHeader />
                    {insight.reasons.map((reason) => (
                      <AnalysisReasonRow key={reason.parameter} reason={reason} />
                    ))}
                  </>
                ) : (
                  <p className="py-4 px-2 text-sm text-gray-600 text-center leading-relaxed">
                    {insight.emptyMessage}
                  </p>
                )}
              </div>
              {/* <p className="mt-2 text-[11px] xs:text-xs text-gray-500 leading-relaxed px-1">
                {insight.disclaimer || INSIGHT_DISCLAIMER}
              </p> */}
            </section>
          )}
        </div>

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 rounded-b-2xl flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl font-semibold text-sm bg-green-50 border-2 border-green-300 text-green-800 hover:bg-green-100 transition"
          >
            OK
          </button>
          {followedPlanCorrectly ? (
            coachPhone ? (
              <button
                onClick={handleContactCoach}
                className="flex-1 py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 transition flex items-center justify-center gap-2"
              >
                📞 Contact Your Sponsor
              </button>
            ) : (
              <div className="flex-1 py-2 px-3 rounded-xl bg-gray-100 border border-gray-200 flex items-center gap-2 text-sm text-gray-500">
                <span>ℹ️</span>
                <span>Sponsor contact number is not set. Please reach out to them directly.</span>
              </div>
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}
