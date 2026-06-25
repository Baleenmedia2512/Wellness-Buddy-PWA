// src/components/DuplicateFoodModal.js
import React from "react";

const DuplicateFoodModal = ({
  foodName,
  mealType,
  duplicateCount,
  onConfirm,
  onCancel,
  isWeight,
  weightValue,
  unit,
  timeDifference,
  existingTime,
}) => {
  // Edge case: Prevent multiple rapid clicks (MUST be before any early returns)
  const [isProcessing, setIsProcessing] = React.useState(false);

  // Edge case: Validate required props based on type
  if (isWeight) {
    if (weightValue == null || !unit || !timeDifference) {
      console.error("DuplicateFoodModal (Weight): Missing required props", {
        weightValue,
        unit,
        timeDifference,
      });
      return null;
    }
  } else {
    if (!foodName || !mealType) {
      console.error("DuplicateFoodModal (Food): Missing required props", {
        foodName,
        mealType,
      });
      return null;
    }
  }

  // Edge case: Validate callback functions
  const safeOnConfirm =
    typeof onConfirm === "function"
      ? onConfirm
      : () => console.error("onConfirm not provided");
  const safeOnCancel =
    typeof onCancel === "function"
      ? onCancel
      : () => console.error("onCancel not provided");

  // Edge case: Prevent backdrop click when modal is animating
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      safeOnCancel();
    }
  };

  const handleConfirm = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      await safeOnConfirm();
    } finally {
      // Reset after a small delay to prevent double-tap issues
      setTimeout(() => setIsProcessing(false), 500);
    }
  };

  const handleCancel = () => {
    if (isProcessing) return;
    safeOnCancel();
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-slideUp"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="duplicate-modal-title"
      >
        <div
          className={`${
            isWeight
              ? "bg-gradient-to-br from-blue-500 to-indigo-600"
              : "bg-gradient-to-br from-amber-500 to-orange-600"
          } p-6 text-white`}
        >
          <div className="flex items-center justify-center mb-3">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
              <svg
                className="w-8 h-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
          </div>
          <h2
            id="duplicate-modal-title"
            className="text-2xl font-bold text-center"
          >
            {isWeight ? "Weight Alert" : "Food Detected"}
          </h2>
        </div>

        <div className="p-6 space-y-4">
          <div
            className={`${
              isWeight
                ? "bg-blue-50 border border-blue-200"
                : "bg-amber-50 border border-amber-200"
            } rounded-xl p-4`}
          >
            {isWeight ? (
              <p className="text-gray-800 text-center leading-relaxed">
                A weight of{" "}
                <span className="font-semibold text-blue-900">
                  {weightValue} {unit}
                </span>{" "}
                is already posted by you{" "}
                {existingTime ? <>at <span className="font-semibold text-blue-900">{existingTime}</span></> : timeDifference}.
              </p>
            ) : (
              <p className="text-gray-800 text-center leading-relaxed">
                <span className="font-semibold text-amber-900">
                  "{foodName?.trim()}"
                </span>
                {duplicateCount && duplicateCount > 1 ? (
                  <span> are</span>
                ) : (
                  <span> is</span>
                )}{" "}
                already added in your{" "}
                <span className="font-semibold text-amber-900">{mealType}</span>{" "}
                list.
              </p>
            )}
          </div>

          <p className="text-gray-600 text-center text-sm">
            Do you want to add it again?
          </p>


          <div className="flex gap-3 pt-2">
            <button
              onClick={handleCancel}
              disabled={isProcessing}
              aria-label={`Cancel and don't add duplicate ${
                isWeight ? "weight" : "food"
              }`}
              className="flex-1 bg-gray-100 text-gray-700 py-3.5 px-4 rounded-xl font-semibold hover:bg-gray-200 active:scale-95 transition-all duration-200 shadow-sm touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed"
            >
              No, Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={isProcessing}
              aria-label={`Confirm and add duplicate ${
                isWeight ? "weight" : "food"
              }`}
              className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 text-white py-3.5 px-4 rounded-xl font-semibold hover:from-emerald-600 hover:to-teal-700 active:scale-95 transition-all duration-200 shadow-lg touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? "Adding..." : "Yes, Add Again"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DuplicateFoodModal;
