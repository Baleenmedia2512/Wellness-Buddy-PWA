// src/components/ManualWatchEntryModal.js
import React, { useState, useEffect } from "react";
import { X, Loader2, Dumbbell } from "lucide-react";
import { EmojiOrNative } from "../../../shared/components/icons/EmojiImage";
import { isIOS } from "../../../shared/utils/platform";
import TouchFeedbackButton from "../../../shared/components/TouchFeedbackButton";
import {
  WATCH_KCAL_MAX,
  WATCH_KCAL_STEP,
  WATCH_KCAL_QUICK_ADD,
  parseKcal,
  clampKcal,
  watchKcalBounds,
  nextWatchKcal,
} from "../domain/watchKcalStepper";

const DEFAULT_SOURCE = "Smartwatch";

/**
 * ManualWatchEntryModal
 * Manual calories-burned entry for a smartwatch / fitness screenshot.
 */
const ManualWatchEntryModal = ({
  isOpen,
  onClose,
  onSave,
  onBack,
  initialCaloriesBurned = '',
  /** Changes when the underlying capture changes — forces a fresh form. */
  formKey = null,
  /** Today's highest logged watch kcal (same-day policy: max, not sum). */
  todayBaseline = 0,
  loading = false,
}) => {
  const [caloriesBurned, setCaloriesBurned] = useState(0);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const { baseline: baselineKcal, min: minKcal, max: maxKcal } = watchKcalBounds(todayBaseline);

  useEffect(() => {
    if (!isOpen) {
      setCaloriesBurned(0);
      setError('');
      return;
    }
    if (loading) return;
    const fromAi = parseKcal(initialCaloriesBurned);
    const baseline = parseKcal(todayBaseline);
    setCaloriesBurned(Math.max(fromAi, baseline));
    setError('');
  }, [isOpen, initialCaloriesBurned, formKey, todayBaseline, loading]);

  const resetForm = () => {
    setCaloriesBurned(0);
    setError("");
  };

  const bumpBy = (amount) => {
    setCaloriesBurned((v) => nextWatchKcal(v, amount, todayBaseline));
  };

  const handleCancel = () => {
    resetForm();
    onClose();
  };

  const handleSave = () => {
    setError("");

    const kcal = clampKcal(caloriesBurned, minKcal, maxKcal);
    if (kcal <= 0) {
      setError("Please enter a valid calories burned value");
      return;
    }
    if (kcal > WATCH_KCAL_MAX) {
      setError("Calories burned seems too high (max 10,000)");
      return;
    }

    // Hand off without awaiting network — parent closes classify and saves in background.
    resetForm();
    onClose();
    void Promise.resolve(onSave({ caloriesBurned: kcal, source: DEFAULT_SOURCE }));
  };

  if (!isOpen) return null;

  const enteredKcal = clampKcal(caloriesBurned, minKcal, maxKcal);
  const noChange = !loading && enteredKcal <= baselineKcal;
  const saveDisabled = isSaving || loading || noChange;

  const saveLabel = (() => {
    if (isSaving) return 'Saving…';
    if (loading) return 'Loading…';
    if (noChange) return 'Up to date';
    if (baselineKcal > 0 && enteredKcal > baselineKcal) {
      return `Update to ${enteredKcal} kcal`;
    }
    return 'Log Activity';
  })();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
        <div className="relative flex flex-col items-center px-4 pt-5 pb-4 border-b border-gray-100">
          {onBack && (
            <button
              onClick={() => { resetForm(); onBack(); }}
              className="absolute left-3 top-3 p-2 rounded-xl hover:bg-gray-100 transition-colors"
              title="Back"
            >
              <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <button onClick={handleCancel} className="absolute right-3 top-3 p-2 rounded-xl hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
          <div className="mb-2.5 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100">
            {/* iOS WebView often blanks custom emoji SVGs — use Lucide so the icon always shows */}
            {isIOS() ? (
              <Dumbbell className="h-9 w-9 text-emerald-700" strokeWidth={2.25} aria-hidden />
            ) : (
              <img
                src={`${process.env.PUBLIC_URL || ''}/emoji/1f3cb-green.svg`}
                alt=""
                draggable={false}
                aria-hidden="true"
                className="inline-block h-9 w-9 select-none object-contain"
              />
            )}
          </div>
          <h2 className="truncate text-base font-bold text-gray-800 tracking-tight">Calories burnt</h2>
          <p className="text-xs text-gray-400 mt-0.5">How much you&apos;ve burnt so far today</p>
        </div>

        <div className="p-5 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Loading today&apos;s total…
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <div className="flex items-center gap-5">
                <TouchFeedbackButton
                  onClick={() => bumpBy(-WATCH_KCAL_STEP)}
                  disabled={isSaving || enteredKcal <= minKcal}
                  className="w-11 h-11 rounded-full border-2 border-gray-200 flex items-center justify-center text-xl font-bold text-gray-700 disabled:opacity-30"
                  aria-label="Decrease"
                >
                  −
                </TouchFeedbackButton>
                <span className="min-w-[7.5rem] text-center text-2xl font-bold text-gray-900 tabular-nums">
                  {enteredKcal} kcal
                </span>
                <TouchFeedbackButton
                  onClick={() => bumpBy(WATCH_KCAL_STEP)}
                  disabled={isSaving || enteredKcal >= maxKcal}
                  className="w-11 h-11 rounded-full border-2 border-gray-200 flex items-center justify-center text-xl font-bold text-gray-700 disabled:opacity-30"
                  aria-label="Increase"
                >
                  +
                </TouchFeedbackButton>
              </div>
              <div className="w-full">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide text-center mb-2">
                  Quick add
                </p>
                <div className="flex gap-2 justify-center flex-wrap">
                  {WATCH_KCAL_QUICK_ADD.map((preset) => {
                    const amount = Number(preset.amount) || 0;
                    const disabled = isSaving || amount <= 0 || enteredKcal + amount > maxKcal;
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
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl">
              <EmojiOrNative emoji="⚠️" className="w-4 h-4" nativeClassName="text-sm" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="flex gap-3 px-5 pb-5">
          <button
            onClick={handleCancel}
            disabled={isSaving}
            className="flex-1 px-4 py-3 border-2 border-gray-200 text-gray-600 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saveDisabled}
            className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 active:bg-emerald-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSaving ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Saving...
              </>
            ) : (
              <>{saveLabel}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ManualWatchEntryModal;
