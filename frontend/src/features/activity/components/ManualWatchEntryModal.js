// src/components/ManualWatchEntryModal.js
import React, { useState, useEffect } from "react";
import { X, Loader2 } from "lucide-react";
import { EmojiOrNative } from "../../../shared/components/icons/EmojiImage";

const DEFAULT_SOURCE = "Smartwatch";

function parseKcal(value) {
  const n = Number(String(value ?? '').replace(/[^\d.]/g, ''));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

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
  const [caloriesBurned, setCaloriesBurned] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setCaloriesBurned('');
      setError('');
      return;
    }
    if (loading) return;
    const fromAi = parseKcal(initialCaloriesBurned);
    const baseline = parseKcal(todayBaseline);
    const prefill = Math.max(fromAi, baseline);
    setCaloriesBurned(prefill > 0 ? String(prefill) : '');
    setError('');
  }, [isOpen, initialCaloriesBurned, formKey, todayBaseline, loading]);

  const resetForm = () => {
    setCaloriesBurned("");
    setError("");
  };

  const handleCancel = () => {
    resetForm();
    onClose();
  };

  const handleSave = async () => {
    setError("");

    const kcal = Number(caloriesBurned);
    if (!caloriesBurned || isNaN(kcal) || kcal <= 0) {
      setError("Please enter a valid calories burned value");
      return;
    }
    if (kcal > 10000) {
      setError("Calories burned seems too high (max 10,000)");
      return;
    }

    try {
      setIsSaving(true);
      await onSave({ caloriesBurned: kcal, source: DEFAULT_SOURCE });
      resetForm();
      onClose();
    } catch (err) {
      setError(err.message || "Failed to save activity");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const enteredKcal = parseKcal(caloriesBurned);
  const baselineKcal = parseKcal(todayBaseline);
  const noChange = !loading && enteredKcal > 0 && enteredKcal <= baselineKcal;
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
          <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mb-2.5">
            <img
              src={`${process.env.PUBLIC_URL || ''}/emoji/1f3cb-green.svg`}
              alt=""
              draggable={false}
              aria-hidden="true"
              className="h-9 w-9 inline-block select-none object-contain"
            />
          </div>
          <h2 className="text-base font-bold text-gray-800 tracking-tight">Calories burned</h2>
          <p className="text-xs text-gray-400 mt-0.5">How much you&apos;ve burned so far today</p>
        </div>

        <div className="p-5 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Loading today&apos;s total…
            </div>
          ) : (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Calories Burned (kcal) <span className="text-red-500">*</span>
            </label>
            {baselineKcal > 0 && (
              <p className="mb-2 text-xs text-emerald-700">
                {/* Logged today: {baselineKcal} kcal — enter a higher total to update */}
              </p>
            )}
            <input
              type="text"
              inputMode="decimal"
              pattern="[0-9]*"
              value={caloriesBurned}
              onChange={(e) => setCaloriesBurned(e.target.value)}
              placeholder="e.g., 350"
              min="1"
              max="10000"
              disabled={isSaving}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-emerald-400 focus:outline-none text-base bg-white disabled:opacity-60"
              style={{ fontSize: "16px" }}
            />
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
