/**
 * Simple serving / volume stepper for classify-sheet presets (Afresh, Water).
 */
import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';

/**
 * @param {{
 *   isOpen: boolean,
 *   title: string,
 *   subtitle?: string,
 *   unitLabel: string,
 *   min?: number,
 *   max?: number,
 *   step?: number,
 *   defaultValue?: number,
 *   formatValue?: (n: number) => string,
 *   onClose: () => void,
 *   onConfirm: (value: number) => Promise<void>,
 *   confirmLabel?: string,
 * }} props
 */
export default function ServingStepperModal({
  isOpen,
  title,
  subtitle,
  unitLabel,
  min = 1,
  max = 8,
  step = 1,
  defaultValue = 1,
  formatValue,
  onClose,
  onConfirm,
  confirmLabel = 'Save',
}) {
  const [value, setValue] = useState(defaultValue);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setValue(defaultValue);
    setError('');
    setSaving(false);
  }, [isOpen, defaultValue]);

  if (!isOpen) return null;

  const display = formatValue ? formatValue(value) : String(value);

  const handleConfirm = async () => {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      await onConfirm(value);
      onClose();
    } catch (err) {
      setError(err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="relative flex flex-col items-center px-4 pt-5 pb-3 border-b border-gray-100">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="absolute right-3 top-3 p-1.5 rounded-xl hover:bg-gray-100"
            aria-label="Close"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
          <h2 className="text-base font-bold text-gray-900">{title}</h2>
          {subtitle && <p className="text-xs text-gray-500 mt-1 text-center">{subtitle}</p>}
        </div>

        <div className="px-6 py-6 flex flex-col items-center gap-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{unitLabel}</p>
          <div className="flex items-center gap-5">
            <TouchFeedbackButton
              onClick={() => setValue((v) => Math.max(min, v - step))}
              disabled={saving || value <= min}
              className="w-11 h-11 rounded-full border-2 border-gray-200 flex items-center justify-center text-xl font-bold text-gray-700 disabled:opacity-30"
              aria-label="Decrease"
            >
              −
            </TouchFeedbackButton>
            <span className="min-w-[4.5rem] text-center text-2xl font-bold text-gray-900 tabular-nums">
              {display}
            </span>
            <TouchFeedbackButton
              onClick={() => setValue((v) => Math.min(max, v + step))}
              disabled={saving || value >= max}
              className="w-11 h-11 rounded-full border-2 border-gray-200 flex items-center justify-center text-xl font-bold text-gray-700 disabled:opacity-30"
              aria-label="Increase"
            >
              +
            </TouchFeedbackButton>
          </div>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 w-full text-center">
              {error}
            </p>
          )}
        </div>

        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl border border-gray-300 text-sm font-semibold text-gray-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50"
          >
            {saving ? 'Saving…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Water as food beverage analysis (inferred hydration / diary). */
export function buildWaterAnalysisResult(ml = 250) {
  const amount = Math.max(50, Math.min(5000, Number(ml) || 250));
  const nutrition = {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
    sugar: 0,
    sodium: 0,
    cholesterol: 0,
  };
  return {
    foods: [{
      name: 'Plain Water',
      nutrition,
      portion: `${amount} ml`,
      volume_ml: amount,
      unit: 'ml',
      isLiquid: true,
      weight_g: null,
    }],
    total: nutrition,
    confidence: 'high',
    processedBy: 'water_preset',
  };
}
