/**
 * frontend/src/features/nutrition/components/ShakeCalculatorModal.jsx
 *
 * Presentation modal for the Herbalife Shake Nutrition Calculator.
 *
 * Responsibilities:
 *   - Render a per-product serving stepper (− / count / +).
 *   - Show live macro summary derived from useShakeCalculator.
 *   - Delegate save to parent via onLog(payload) — no direct I/O.
 *   - Zero business logic: all computation lives in useShakeCalculator.
 *
 * Reuses:
 *   - useShakeCalculator (hook)
 *   - SHAKE_PRODUCTS / SHAKE_PRODUCT_IDS (domain constants)
 *   - TouchFeedbackButton (shared UI atom)
 *
 * Does NOT call saveNutritionAnalysis directly — that is the parent's job.
 */

import React from 'react';
import { X } from 'lucide-react';
import { useShakeCalculator } from '../hooks/useShakeCalculator';
import { SHAKE_PRODUCTS, SHAKE_PRODUCT_IDS } from '../domain/shakeProductProfiles';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';

// ─── Macro pill ──────────────────────────────────────────────────────────────

function MacroPill({ label, value, unit, color }) {
  return (
    <div className={`flex flex-col items-center px-3 py-2 rounded-xl ${color}`}>
      <span className="text-[10px] font-semibold uppercase tracking-wide opacity-70">{label}</span>
      <span className="text-lg font-bold leading-none mt-0.5">
        {Number.isFinite(value) ? Math.round(value * 10) / 10 : 0}
      </span>
      <span className="text-[10px] opacity-60">{unit}</span>
    </div>
  );
}

// ─── Serving stepper ─────────────────────────────────────────────────────────

function ServingStepper({ id, profile, count, onIncrement, onDecrement, disabled }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <div className="flex-1 min-w-0 pr-4">
        <p className="font-medium text-gray-900 text-sm leading-tight">{profile.label}</p>
        <p className="text-xs text-gray-500 mt-0.5">{profile.unit}</p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <TouchFeedbackButton
          onClick={() => onDecrement(id)}
          disabled={disabled || count <= profile.minServings}
          aria-label={`Decrease ${profile.label} servings`}
          className="w-8 h-8 rounded-full border-2 border-gray-200 flex items-center justify-center font-bold text-gray-600 hover:border-green-400 hover:text-green-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          −
        </TouchFeedbackButton>
        <span
          className="w-6 text-center font-bold text-gray-900 text-base"
          aria-live="polite"
          aria-label={`${count} servings`}
        >
          {count}
        </span>
        <TouchFeedbackButton
          onClick={() => onIncrement(id)}
          disabled={disabled || count >= profile.maxServings}
          aria-label={`Increase ${profile.label} servings`}
          className="w-8 h-8 rounded-full border-2 border-gray-200 flex items-center justify-center font-bold text-gray-600 hover:border-green-400 hover:text-green-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          +
        </TouchFeedbackButton>
      </div>
    </div>
  );
}

// ─── Modal ───────────────────────────────────────────────────────────────────

/**
 * @param {{
 *   isOpen: boolean,
 *   onClose: () => void,
 *   onLog: (payload: Object) => Promise<void>,
 * }} props
 */
const ShakeCalculatorModal = ({ isOpen, onClose, onLog }) => {
  const {
    servings, totals, hasServings,
    increment, decrement, reset, buildFoodPayload,
  } = useShakeCalculator();

  const [error, setError] = React.useState('');
  const saveStartedRef = React.useRef(false);

  if (!isOpen) return null;

  const handleLog = () => {
    if (!hasServings || saveStartedRef.current) return;
    saveStartedRef.current = true;
    // Hand off without awaiting network — parent closes classify and saves in background.
    const payload = buildFoodPayload();
    reset();
    onClose();
    void Promise.resolve(onLog(payload)).catch((err) => {
      saveStartedRef.current = false;
      setError(err?.message || 'Failed to save shake. Please try again.');
    });
  };

  const handleClose = () => {
    if (saveStartedRef.current) return;
    setError('');
    onClose();
  };

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Shake Nutrition Calculator"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      {/* Sheet */}
      <div className="w-full sm:max-w-md bg-white sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-gray-100 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
            <img
              src={`${process.env.PUBLIC_URL || ''}/bottle.png`}
              alt=""
              draggable={false}
              aria-hidden="true"
              className="h-5 w-5 inline-block select-none object-contain"
            />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-gray-900 text-base leading-tight">Shake</h2>
            <p className="text-xs text-gray-500">Select Number of scoops used in this shake</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close shake calculator"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-500 text-white transition-colors hover:bg-red-600"
          >
            <X className="h-5 w-5" strokeWidth={2.25} aria-hidden="true" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">

          {/* Product steppers */}
          <div className="px-5 pt-4 pb-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Products</p>
            {SHAKE_PRODUCT_IDS.map((id) => (
              <ServingStepper
                key={id}
                id={id}
                profile={SHAKE_PRODUCTS[id]}
                count={servings[id]}
                onIncrement={increment}
                onDecrement={decrement}
              />
            ))}
          </div>

          {/* Live macro summary */}
          <div className="px-5 py-4 bg-gray-50 mx-4 mb-4 rounded-xl">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Combined Nutrition
            </p>
            {hasServings ? (
              <div className="grid grid-cols-4 gap-2">
                <MacroPill
                  label="Kcal"
                  value={totals.calories}
                  unit="kcal"
                  color="bg-orange-50 text-orange-700"
                />
                <MacroPill
                  label="Protein"
                  value={totals.protein}
                  unit="g"
                  color="bg-blue-50 text-blue-700"
                />
                <MacroPill
                  label="Carbs"
                  value={totals.carbs}
                  unit="g"
                  color="bg-yellow-50 text-yellow-700"
                />
                <MacroPill
                  label="Fat"
                  value={totals.fat}
                  unit="g"
                  color="bg-red-50 text-red-700"
                />
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-2">
                Add at least one serving to see nutrition
              </p>
            )}
            {hasServings && totals.fiber > 0 && (
              <p className="text-[10px] text-gray-400 text-center mt-2">
                Fiber {Math.round(totals.fiber * 10) / 10}g
                {totals.sugar > 0 ? ` · Sugar ${Math.round(totals.sugar * 10) / 10}g` : ''}
              </p>
            )}
          </div>

        </div>

        {/* Footer actions */}
        <div className="px-5 pb-5 pt-3 border-t border-gray-100 shrink-0">
          {error && (
            <p className="text-sm text-red-600 text-center mb-3" role="alert">{error}</p>
          )}
          <div>
            <TouchFeedbackButton
              onClick={handleLog}
              disabled={!hasServings}
              className={`w-full px-4 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
                !hasServings
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800'
              }`}
              aria-label="Save shake"
            >
              <span>Save</span>
            </TouchFeedbackButton>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShakeCalculatorModal;
