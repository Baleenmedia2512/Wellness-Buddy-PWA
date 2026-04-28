// src/components/ManualFoodEntryModal.js
import React, { useState } from "react";
import { X } from "lucide-react";

/**
 * Manual Food Entry Modal
 * Opens when the AI model is temporarily unavailable.
 * Lets the user type in food name + macros so the entry
 * can still be saved to the database without AI involvement.
 */
const ManualFoodEntryModal = ({ isOpen, onClose, onSave, onBack }) => {
  const [foodName, setFoodName] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [fiber, setFiber] = useState("");
  const [portion, setPortion] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const resetForm = () => {
    setFoodName("");
    setCalories("");
    setProtein("");
    setCarbs("");
    setFat("");
    setFiber("");
    setPortion("");
    setError("");
  };

  const handleCancel = () => {
    resetForm();
    onClose();
  };

  const handleSave = async () => {
    setError("");

    // Validate food name
    if (!foodName.trim()) {
      setError("Please enter a food name");
      return;
    }

    // Validate calories (required)
    const calVal = parseFloat(calories);
    if (!calories || isNaN(calVal) || calVal < 0) {
      setError("Please enter a valid calorie amount");
      return;
    }
    if (calVal > 5000) {
      setError("Calories seem too high (max 5000). Please check your entry.");
      return;
    }

    // Validate macros (optional but must be numbers if provided)
    const proteinVal = protein !== "" ? parseFloat(protein) : 0;
    const carbsVal = carbs !== "" ? parseFloat(carbs) : 0;
    const fatVal = fat !== "" ? parseFloat(fat) : 0;
    const fiberVal = fiber !== "" ? parseFloat(fiber) : 0;

    if (isNaN(proteinVal) || proteinVal < 0) { setError("Protein must be 0 or more"); return; }
    if (isNaN(carbsVal) || carbsVal < 0) { setError("Carbs must be 0 or more"); return; }
    if (isNaN(fatVal) || fatVal < 0) { setError("Fat must be 0 or more"); return; }
    if (isNaN(fiberVal) || fiberVal < 0) { setError("Fiber must be 0 or more"); return; }

    try {
      setIsSaving(true);
      await onSave({
        foodName: foodName.trim(),
        calories: Math.round(calVal),
        protein: Math.round(proteinVal * 10) / 10,
        carbs: Math.round(carbsVal * 10) / 10,
        fat: Math.round(fatVal * 10) / 10,
        fiber: Math.round(fiberVal * 10) / 10,
        portion: portion.trim() || "1 serving",
      });
      resetForm();
      onClose();
    } catch (err) {
      setError(err.message || "Failed to save food entry");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
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
          <button
            onClick={handleCancel}
            className="absolute right-3 top-3 p-2 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
          {/* Icon */}
          <div className="w-14 h-14 bg-orange-100 rounded-2xl flex items-center justify-center mb-2.5">
            <span className="text-3xl">🍽️</span>
          </div>
          {/* Title */}
          <h2 className="text-base font-bold text-gray-800 tracking-tight">Manual Food Entry</h2>
          <p className="text-xs text-gray-400 mt-0.5">AI unavailable — enter nutrition manually</p>
        </div>

        {/* Form */}
        <div className="p-5 space-y-4">
          {/* Food Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Food Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={foodName}
              onChange={(e) => setFoodName(e.target.value)}
              placeholder="e.g., Rice & Dal, Chapati, Idli"
              autoFocus
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-orange-400 focus:outline-none text-base bg-white"
              style={{ fontSize: "16px" }}
            />
          </div>

          {/* Portion */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Portion <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={portion}
              onChange={(e) => setPortion(e.target.value)}
              placeholder="e.g., 1 plate, 2 chapatis, 1 cup"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-orange-400 focus:outline-none text-base bg-white"
              style={{ fontSize: "16px" }}
            />
          </div>

          {/* Calories */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Calories (kcal) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              inputMode="decimal"
              value={calories}
              onChange={(e) => setCalories(e.target.value)}
              placeholder="e.g., 450"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-red-400 focus:outline-none text-lg font-semibold bg-white"
              style={{ fontSize: "16px" }}
            />
          </div>

          {/* Macros grid */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Macronutrients (g) <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              {/* Protein */}
              <div>
                <label className="block text-xs text-blue-600 font-medium mb-1">Protein</label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  value={protein}
                  onChange={(e) => setProtein(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2.5 border-2 border-blue-200 rounded-xl focus:border-blue-400 focus:outline-none text-base bg-white"
                  style={{ fontSize: "16px" }}
                />
              </div>
              {/* Carbs */}
              <div>
                <label className="block text-xs text-yellow-600 font-medium mb-1">Carbs</label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  value={carbs}
                  onChange={(e) => setCarbs(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2.5 border-2 border-yellow-200 rounded-xl focus:border-yellow-400 focus:outline-none text-base bg-white"
                  style={{ fontSize: "16px" }}
                />
              </div>
              {/* Fat */}
              <div>
                <label className="block text-xs text-purple-600 font-medium mb-1">Fat</label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  value={fat}
                  onChange={(e) => setFat(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2.5 border-2 border-purple-200 rounded-xl focus:border-purple-400 focus:outline-none text-base bg-white"
                  style={{ fontSize: "16px" }}
                />
              </div>
              {/* Fiber */}
              <div>
                <label className="block text-xs text-green-600 font-medium mb-1">Fiber</label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  value={fiber}
                  onChange={(e) => setFiber(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2.5 border-2 border-green-200 rounded-xl focus:border-green-400 focus:outline-none text-base bg-white"
                  style={{ fontSize: "16px" }}
                />
              </div>
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

        {/* Footer Buttons */}
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
            className="flex-1 px-4 py-3 bg-orange-500 text-white rounded-xl text-sm font-semibold hover:bg-orange-600 active:bg-orange-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
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
              <>Save Entry</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ManualFoodEntryModal;
