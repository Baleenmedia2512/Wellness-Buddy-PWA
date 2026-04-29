// src/components/ManualWatchEntryModal.js
import React, { useState } from "react";
import { X } from "lucide-react";

const SOURCES = [
  "Fitbit",
  "Apple Watch",
  "Samsung Galaxy Watch",
  "Mi Band / Xiaomi",
  "Garmin",
  "Other",
];

/**
 * ManualWatchEntryModal
 * Opens when AI is unavailable and the user uploaded a smartwatch/fitness screenshot.
 * Lets them enter calories burned and the device source manually.
 */
const ManualWatchEntryModal = ({ isOpen, onClose, onSave, onBack }) => {
  const [caloriesBurned, setCaloriesBurned] = useState("");
  const [source, setSource] = useState("Fitbit");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const resetForm = () => {
    setCaloriesBurned("");
    setSource("Fitbit");
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
      await onSave({ caloriesBurned: kcal, source });
      resetForm();
      onClose();
    } catch (err) {
      setError(err.message || "Failed to save activity");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
        {/* Header */}
        <div className="relative flex flex-col items-center px-4 pt-5 pb-4 border-b border-gray-100">
          {/* Back */}
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
          {/* Close */}
          <button onClick={handleCancel} className="absolute right-3 top-3 p-2 rounded-xl hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
          {/* Icon */}
          <div className="w-14 h-14 bg-purple-100 rounded-2xl flex items-center justify-center mb-2.5">
            <span className="text-3xl">⌚</span>
          </div>
          {/* Title */}
          <h2 className="text-base font-bold text-gray-800 tracking-tight">Manual Watch Entry</h2>
          <p className="text-xs text-gray-400 mt-0.5">AI unavailable — log your activity manually</p>
        </div>

        {/* Form */}
        <div className="p-5 space-y-4">
          {/* Calories Burned */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Calories Burned (kcal) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              inputMode="decimal"
              value={caloriesBurned}
              onChange={(e) => setCaloriesBurned(e.target.value)}
              placeholder="e.g., 350"
              min="1"
              max="10000"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-purple-400 focus:outline-none text-base bg-white"
              style={{ fontSize: "16px" }}
            />
          </div>

          {/* Source device */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Device / App
            </label>
            <div className="grid grid-cols-2 gap-2">
              {SOURCES.map((s) => (
                <button
                  key={s}
                  onClick={() => setSource(s)}
                  className={`px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-colors ${
                    source === s
                      ? "bg-purple-500 border-purple-500 text-white"
                      : "bg-white border-gray-200 text-gray-600 hover:border-purple-300 hover:bg-purple-50"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
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
            disabled={isSaving}
            className="flex-1 px-4 py-3 bg-purple-500 text-white rounded-xl text-sm font-semibold hover:bg-purple-600 active:bg-purple-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
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
              <>Log Activity</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ManualWatchEntryModal;
