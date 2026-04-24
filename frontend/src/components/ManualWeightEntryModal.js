// src/components/ManualWeightEntryModal.js
import React, { useState } from "react";
import { X, Flame } from "lucide-react";

// Custom weighing scale icon component (matching Dashboard)
const WeighingScaleIcon = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {/* Outer rounded square (scale body) */}
    <rect x="3" y="3" width="18" height="18" rx="3" ry="3" />
    {/* Inner dial display area */}
    <path d="M6 10 C6 7, 18 7, 18 10" />
    {/* Dial tick marks */}
    <line x1="8" y1="8.5" x2="8" y2="9.5" />
    <line x1="12" y1="7" x2="12" y2="8" />
    <line x1="16" y1="8.5" x2="16" y2="9.5" />
    {/* Needle pointing up */}
    <line x1="12" y1="12" x2="12" y2="9" />
  </svg>
);

/**
 * Manual Weight Entry Modal
 * Opens when automatic weight detection fails
 * Supports manual BMR entry
 */
const ManualWeightEntryModal = ({ isOpen, onClose, onSave, imagePreview, onBack, lastWeight, altSwitchButtons }) => {
  const [weight, setWeight] = useState("");
  const [unit, setUnit] = useState("kg");
  const [bmr, setBmr] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    try {
      setError("");

      // Validate weight input
      const weightValue = parseFloat(weight);

      if (!weight || isNaN(weightValue)) {
        setError("Please enter a valid weight");
        return;
      }

      if (weightValue <= 0) {
        setError("Weight must be greater than 0");
        return;
      }

      const minWeight = unit === "kg" ? 20 : 44;
      const maxWeight = unit === "kg" ? 300 : 660;

      if (weightValue < minWeight || weightValue > maxWeight) {
        setError(
          `Weight must be between ${minWeight} and ${maxWeight} ${unit}`,
        );
        return;
      }

      // Validate BMR if provided (optional field)
      let bmrValue = null;
      if (bmr && bmr.trim() !== "") {
        bmrValue = parseFloat(bmr);
        if (isNaN(bmrValue) || bmrValue <= 0) {
          setError("BMR must be a positive number");
          return;
        }
      }

      setIsSaving(true);

      // Call parent save handler
      await onSave({
        weightValue,
        unit,
        bmr: bmrValue,
      });

      // Reset and close
      setWeight("");
      setUnit("kg");
      setBmr("");
      setError("");
      onClose();
    } catch (err) {
      console.error("❌ Manual entry error:", err);
      setError(err.message || "Failed to save weight");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setWeight("");
    setUnit("kg");
    setBmr("");
    setError("");
    onClose();
  };

  const handleBack = () => {
    setWeight("");
    setUnit("kg");
    setBmr("");
    setError("");
    onBack();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="relative flex flex-col items-center px-4 pt-4 pb-3 border-b border-gray-100">
          {/* Back */}
          {onBack && (
            <button
              onClick={handleBack}
              className="absolute left-3 top-3 p-1.5 rounded-xl hover:bg-gray-100 transition-colors"
              title="Back"
            >
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          {/* Close */}
          <button
            onClick={handleCancel}
            className="absolute right-3 top-3 p-1.5 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
          {/* Icon */}
          <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center mb-2">
            <WeighingScaleIcon className="w-5 h-5 text-green-600" />
          </div>
          {/* Title */}
          <h2 className="text-sm font-bold text-gray-800">Enter Weight Manually</h2>
          <p className="text-xs text-gray-400 mt-0.5">Could not detect weight automatically</p>
        </div>

        {/* Content */}
        <div className="px-4 pt-3 pb-2 space-y-3">
          {/* Image Preview (if available) */}
          {imagePreview && (
            <div className="relative rounded-lg overflow-hidden bg-gray-100">
              <img
                src={imagePreview}
                alt="Weight scale"
                className="w-full h-48 object-contain"
              />
              <div className="absolute top-2 right-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                Auto-detect failed
              </div>
            </div>
          )}

          {/* Last weight hint */}
          {lastWeight && (
            <div className="flex items-center gap-2 bg-purple-50 border border-purple-100 rounded-xl px-3 py-2">
              <span className="text-sm">📌</span>
              <div>
                <p className="text-xs text-purple-600 font-semibold">Last entry</p>
                <p className="text-xs text-purple-800 font-bold">
                  {lastWeight.value} {lastWeight.unit || "kg"}
                  {lastWeight.date ? (
                    <span className="font-normal text-purple-500 ml-1.5">
                      — {new Date(lastWeight.date).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  ) : null}
                </p>
              </div>
            </div>
          )}

          {/* Manual Entry Form */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                Weight Value
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="e.g., 72.5"
                  autoFocus
                  className="flex-1 min-w-0 px-3 py-2.5 border-2 border-gray-300 rounded-xl focus:border-green-400 focus:outline-none text-sm font-semibold bg-white"
                  style={{ fontSize: "16px" }}
                />
                {/* Unit toggle */}
                <div
                  className="relative flex items-center bg-gray-200 rounded-full p-1 cursor-pointer flex-shrink-0"
                  onClick={() => setUnit(unit === "kg" ? "lbs" : "kg")}
                  style={{ width: "76px", height: "36px" }}
                >
                  <div
                    className="absolute bg-green-500 rounded-full transition-all duration-300"
                    style={{ width: "34px", height: "28px", left: unit === "kg" ? "4px" : "38px" }}
                  />
                  <span className={`relative z-10 flex-1 text-center font-bold text-xs transition-colors ${unit === "kg" ? "text-white" : "text-gray-500"}`}>kg</span>
                  <span className={`relative z-10 flex-1 text-center font-bold text-xs transition-colors ${unit === "lbs" ? "text-white" : "text-gray-500"}`}>lbs</span>
                </div>
              </div>
            </div>

            {/* BMR Field */}
            <div>
              <label className="flex items-center gap-1 text-xs font-semibold text-gray-600 mb-1.5">
                <Flame className="w-3.5 h-3.5 text-orange-500" />
                BMR (kcal) <span className="text-gray-400 font-normal">— optional</span>
              </label>
              <input
                type="number"
                inputMode="numeric"
                value={bmr}
                onChange={(e) => setBmr(e.target.value)}
                placeholder="e.g. 2200"
                className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-xl focus:border-orange-400 focus:outline-none text-sm font-semibold bg-white"
                style={{ fontSize: "16px" }}
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-xs font-medium">
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-200 bg-gray-50">
          <button
            onClick={handleCancel}
            disabled={isSaving}
            className="flex-1 px-4 py-2.5 border-2 border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-white transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !weight}
            className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <span className="flex items-center justify-center gap-1.5">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                Saving...
              </span>
            ) : (
              "Save Weight"
            )}
          </button>
        </div>

        {/* Wrong type strip */}
        {altSwitchButtons?.length > 0 && (
          <div className="flex items-center gap-2 px-4 pb-3">
            <span className="text-xs text-gray-400 whitespace-nowrap">Not weight?</span>
            <div className="flex gap-1.5 flex-1">
              {altSwitchButtons.map((btn) => (
                <button
                  key={btn.label}
                  onClick={btn.onClick}
                  className="flex-1 flex items-center justify-center gap-1 border border-gray-200 bg-white hover:bg-gray-50 text-gray-500 py-1.5 rounded-full text-xs font-medium transition-colors"
                >
                  <span>{btn.icon}</span>
                  <span>{btn.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManualWeightEntryModal;
