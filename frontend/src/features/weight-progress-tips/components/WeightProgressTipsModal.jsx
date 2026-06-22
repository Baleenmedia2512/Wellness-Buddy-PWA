/**
 * WeightProgressTipsModal.jsx
 *
 * Shown automatically when a weight upload results in reverse progress
 * (user gained weight in loss-mode or lost weight in gain-mode).
 *
 * Sections:
 *   1. Personalised header — goal, weight change, explanation
 *   2. Yesterday's analysis — calories, protein, carbs, fat, water
 *   3. Footer — OK (close) / NO (open gallery)
 */
import React from 'react';
import { X, AlertCircle, CheckCircle, TrendingUp, TrendingDown } from 'lucide-react';

// ─── Sub-components ───────────────────────────────────────────────────────────

/**
 * Single row in the "Yesterday's Analysis" table.
 * Shows consumed vs target (e.g. "1340 vs 1200 kcal").
 */
function AnalysisRow({ label, icon, target, consumed, unit }) {
  const consumedNum = consumed != null && Number.isFinite(consumed) ? consumed : 0;
  const hasTarget = target != null && Number.isFinite(target) && target > 0;
  const consumedDisplay = Math.round(consumedNum).toLocaleString();
  const targetDisplay = hasTarget ? Math.round(target).toLocaleString() : '—';

  const diff = hasTarget ? consumedNum - target : null;
  const consumedClass =
    diff == null ? 'text-gray-700' :
    diff > 0     ? 'text-red-600' :
    diff < 0     ? 'text-orange-600' :
                   'text-green-600';

  return (
    <div className="flex items-center py-3 border-b border-gray-100 last:border-0">
      {/* Col 1: icon + label — fixed width so all labels align */}
      <span className="flex items-center gap-2 text-sm font-semibold text-gray-700 w-[150px] shrink-0">
        {icon && <span>{icon}</span>}
        {label}
      </span>
      {/* Col 2: consumed — fixed width, right-aligned */}
      <strong className={`${consumedClass} text-base font-bold w-[60px] text-right shrink-0`}>
        {consumedDisplay}
      </strong>
      {/* Col 3: vs — fixed width, centered */}
      <span className="text-gray-400 font-medium w-[36px] text-center shrink-0">vs</span>
      {/* Col 4: target + unit — remaining space, left-aligned */}
      <span>
        <strong className="text-gray-700 text-base font-bold">{targetDisplay}</strong>
        <span className="text-gray-500 text-xs ml-1">{unit}</span>
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
  if (!isOpen || !comparison) return null;

  const isFirstUpload  = comparison.weight.direction === 'first';
  const displayName    = userName || 'there';
  const goalLabel      = goalMode === 'loss' ? 'Weight Loss'
                       : goalMode === 'gain' ? 'Weight Gain'
                       : 'Weight Management';
  const weightChange   = comparison.weight.change ?? 0;
  const prevWeight     = comparison.weight.previous;
  const currWeight     = comparison.weight.current;

  const explanation = isFirstUpload
    ? `Welcome! Your starting weight is ${currWeight} kg. Let's begin your ${goalLabel.toLowerCase()} journey!`
    : followedPlanCorrectly
    ? `You followed your plan correctly, but your weight increased. Please contact your coach for guidance.`
    : weightChange > 0
    ? `Your weight is higher than your previous weight.`
    : `Your weight is lower than your previous weight.`;

  const handleNoOpenGallery = () => {
    onClose();
    onOpenGallery?.();
  };

  const handleContactCoach = () => {
    if (coachPhone) {
      // _system opens the native phone dialer on Android/iOS via Capacitor
      window.open(`tel:${coachPhone}`, '_system');
    }
  };

  const yNutrition = comparison.nutrition?.yesterday  || {};
  const targets    = comparison.targets               || {};
  const water      = comparison.water                 || {};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4">
      <div className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto bg-white rounded-2xl shadow-2xl flex flex-col">

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
            {isFirstUpload ? <CheckCircle size={32} className="shrink-0 mt-0.5" /> : <AlertCircle size={32} className="shrink-0 mt-0.5" />}
            <div>
              <h2 className="text-xl font-bold leading-tight">
                {isFirstUpload ? '🎉 Welcome to Your Journey!' : 'Weight Update'}
              </h2>
              <p className="text-sm opacity-90 mt-0.5">Hello, <strong>{displayName}</strong></p>
              <p className="text-sm opacity-90">
                Your Goal: <strong>{goalLabel}</strong>
              </p>
            </div>
          </div>
        </div>

        {/* ── Body ─────────────────────────────────────────────────────── */}
        <div className="flex-1 p-6 space-y-6">

          {/* Weight Change Card */}
          {!isFirstUpload && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="text-center">
                  <p className="text-xs text-gray-500 mb-1">Previous</p>
                  <p className="text-2xl font-bold text-gray-800">{prevWeight} kg</p>
                </div>
                <div className="flex flex-col items-center">
                  {weightChange > 0
                    ? <TrendingUp className="text-red-500" size={28} />
                    : <TrendingDown className="text-green-500" size={28} />
                  }
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500 mb-1">Today</p>
                  <p className="text-2xl font-bold text-orange-600">{currWeight} kg</p>
                </div>
              </div>
              <p className="text-sm text-gray-700 mt-3 text-center font-medium">
                {explanation}
              </p>
            </div>
          )}

          {isFirstUpload && (
            <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 text-center">
              <p className="text-xs text-gray-500 mb-1">Starting Weight</p>
              <p className="text-4xl font-bold text-teal-600">{currWeight} kg</p>
              <p className="text-sm text-gray-600 mt-2">{explanation}</p>
            </div>
          )}

          {/* Yesterday's Analysis */}
          {!isFirstUpload && (
            <section>
              <h3 className="text-base font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <span>📊</span> Daily Summary
              </h3>
              <div className="bg-gray-50 rounded-xl px-4 py-1 divide-y divide-gray-100">
                <AnalysisRow
                  label="Calories"
                  icon="🔥"
                  target={targets.calories ?? null}
                  consumed={yNutrition.calories ?? 0}
                  unit="kcal"
                />
                <AnalysisRow
                  label="Protein"
                  icon="🥩"
                  target={targets.protein ?? null}
                  consumed={yNutrition.protein ?? 0}
                  unit="g"
                />
                <AnalysisRow
                  label="Carbohydrates"
                  icon="🍞"
                  target={targets.carbs ?? null}
                  consumed={yNutrition.carbs ?? 0}
                  unit="g"
                />
                <AnalysisRow
                  label="Fat"
                  icon="🥑"
                  target={targets.fat ?? null}
                  consumed={yNutrition.fat ?? 0}
                  unit="g"
                />
                <AnalysisRow
                  label="Water"
                  icon="💧"
                  target={targets.water ?? water.target ?? null}
                  consumed={water.yesterday ?? 0}
                  unit="ml"
                />
              </div>
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
                📞 Contact Your Coach
              </button>
            ) : (
              <div className="flex-1 py-2 px-3 rounded-xl bg-gray-100 border border-gray-200 flex items-center gap-2 text-sm text-gray-500">
                <span>ℹ️</span>
                <span>Coach contact number is not set. Please reach out to them directly.</span>
              </div>
            )
          ) : null}
        </div>

      </div>
    </div>
  );
}
