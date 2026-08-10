/**
 * Simple serving / volume stepper for classify-sheet presets (Afresh, Water).
 */
import React, { useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';

function ModalHeaderIcon({ iconSrc }) {
  if (!iconSrc) return null;
  const base = process.env.PUBLIC_URL || '';
  return (
    <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-[#e8f5e9]">
      <img
        src={`${base}${iconSrc}`}
        alt=""
        draggable={false}
        className="h-5 w-5 select-none object-contain"
      />
    </div>
  );
}

/**
 * @param {{
 *   isOpen: boolean,
 *   title: string,
 *   subtitle?: string,
 *   unitLabel: string,
 *   showStepper?: boolean,
 *   min?: number,
 *   max?: number,
 *   step?: number,
 *   defaultValue?: number,
 *   formatValue?: (n: number) => string,
 *   baseline?: number|null,
 *   loading?: boolean,
 *   helperText?: string,
 *   quickAddPresets?: Array<{ label: string, amount: number }>,
 *   onClose: () => void,
 *   onConfirm: (value: number) => Promise<void>,
 *   confirmLabel?: string,
 *   iconSrc?: string,
 * }} props
 */
export default function ServingStepperModal({
  isOpen,
  title,
  subtitle,
  unitLabel,
  showStepper = true,
  min = 1,
  max = 8,
  step = 1,
  defaultValue = 1,
  formatValue,
  baseline = null,
  loading = false,
  helperText,
  quickAddPresets = [],
  onClose,
  onConfirm,
  confirmLabel = 'Save',
  iconSrc,
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
  const hasBaseline = baseline != null && Number.isFinite(Number(baseline));
  const baselineMl = hasBaseline ? Number(baseline) : null;
  const delta = hasBaseline ? Math.max(0, value - baselineMl) : null;
  const noChange = hasBaseline && delta === 0;
  const confirmDisabled = saving || loading || noChange;

  const resolvedConfirmLabel = (() => {
    if (saving) return 'Saving…';
    if (loading) return 'Loading…';
    if (hasBaseline && delta > 0 && formatValue) {
      return `Add ${formatValue(delta)}`;
    }
    if (noChange) return 'Up to date';
    return confirmLabel;
  })();

  const bumpBy = (amount) => {
    setValue((v) => Math.min(max, Math.max(min, v + amount)));
  };

  const handleConfirm = () => {
    if (confirmDisabled) return;
    // Hand off without awaiting network — parent closes classify and saves in background.
    onClose();
    void Promise.resolve(onConfirm(value)).catch((err) => {
      setError(err?.message || 'Failed to save');
    });
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
          <ModalHeaderIcon iconSrc={iconSrc} />
          <h2 className="text-base font-bold text-gray-900">{title}</h2>
          {subtitle && <p className="text-xs text-gray-500 mt-1 text-center">{subtitle}</p>}
        </div>

        <div className="px-6 py-6 flex flex-col items-center gap-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-gray-500 py-3">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading today&apos;s total…
            </div>
          ) : (
            <>
              {showStepper && (
                <>
                  {unitLabel ? (
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{unitLabel}</p>
                  ) : null}
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
                </>
              )}

              {quickAddPresets.length > 0 && (
                <div className="w-full">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide text-center mb-2">
                    Quick add
                  </p>
                  <div className="flex gap-2 justify-center flex-wrap">
                    {quickAddPresets.map((preset) => {
                      const amount = Number(preset.amount) || 0;
                      const disabled = saving || amount <= 0 || value + amount > max;
                      return (
                        <TouchFeedbackButton
                          key={preset.label}
                          type="button"
                          onClick={() => bumpBy(amount)}
                          disabled={disabled}
                          className="min-w-[5.5rem] px-4 py-2.5 rounded-xl border-2 border-emerald-200 bg-emerald-50 text-sm font-bold text-emerald-800 disabled:opacity-40 active:bg-emerald-100"
                          aria-label={`Add ${preset.label}`}
                        >
                          +{preset.label}
                        </TouchFeedbackButton>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
          {helperText && !loading && (
            <p className="text-xs text-gray-500 text-center">{helperText}</p>
          )}
         
          
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
            disabled={confirmDisabled}
            className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50"
          >
            {resolvedConfirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Water as food beverage analysis (inferred hydration / diary). */
export function buildWaterAnalysisResult(ml = 200) {
  const amount = Math.max(50, Math.min(5000, Number(ml) || 200));
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
