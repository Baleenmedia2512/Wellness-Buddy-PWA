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
import { X, FlaskConical } from 'lucide-react';
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

  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  if (!isOpen) return null;

  const handleLog = async () => {
    if (!hasServings || saving) return;
    setSaving(true);
    setError('');
    try {
      await onLog(buildFoodPayload());
      reset();
      onClose();
    } catch (err) {
      setError(err?.message || 'Failed to save shake. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (saving) return;
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
            <FlaskConical className="w-5 h-5 text-green-600" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-gray-900 text-base leading-tight">Shake Calculator</h2>
            <p className="text-xs text-gray-500">Build your Herbalife shake combination</p>
          </div>
          <button
            onClick={handleClose}
            disabled={saving}
            aria-label="Close shake calculator"
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" aria-hidden="true" />
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
                disabled={saving}
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
        <div className="px-5 pb-5 pt-3 border-t border-gray-100 shrink-0 space-y-2">
          {error && (
            <p className="text-sm text-red-600 text-center" role="alert">{error}</p>
          )}
          <TouchFeedbackButton
            onClick={handleLog}
            disabled={!hasServings || saving}
            className={`w-full py-3.5 rounded-xl font-bold text-base flex items-center justify-center gap-2 transition-all ${
              !hasServings || saving
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-green-400 to-teal-400 text-white hover:from-green-500 hover:to-teal-500 shadow-sm hover:shadow-md'
            }`}
            aria-label={saving ? 'Saving shake...' : 'Log shake to diary'}
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                <span>Saving...</span>
              </>
            ) : (
              <span>Log Shake to Diary</span>
            )}
          </TouchFeedbackButton>
          <button
            onClick={handleClose}
            disabled={saving}
            className="w-full py-2.5 text-sm text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShakeCalculatorModal;
