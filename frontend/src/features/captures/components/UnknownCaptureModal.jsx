/**
 * frontend/src/features/captures/components/UnknownCaptureModal.jsx
 * ---------------------------------------------------------------------------
 * Shown when `isLowConfidenceFood(detectorResult)` flags a capture the AI
 * couldn't confidently classify. The user picks one of:
 *   - Food       → opens SmartFoodSearchModal (manual food entry)
 *   - Weight     → opens ManualWeightEntryModal
 *   - Education  → opens ManualEducationEntryModal
 *
 * Picking a type ALSO re-tags the pending capture row via the parent's
 * `updatePendingCaptureType` helper so the share link routes correctly.
 *
 * Dismissing the modal leaves the capture tagged 'unknown' (already set by
 * App.js before opening this modal). Captures remain in DB indefinitely
 * per the storage policy decided in PR 2.
 *
 * Self-contained — no Redux/Context, props-only.
 * ---------------------------------------------------------------------------
 */

import React from 'react';
import {
  IMAGE_TYPE_FOOD,
  IMAGE_TYPE_WEIGHT,
  IMAGE_TYPE_EDUCATION,
  USER_SELECTABLE_TYPES,
} from '../../../shared/constants/imageTypes.js';

const OPTION_LABELS = {
  [IMAGE_TYPE_FOOD]:      { icon: '🍽️',  label: 'Food',      sub: 'Log a meal or snack' },
  [IMAGE_TYPE_WEIGHT]:    { icon: '⚖️',  label: 'Weight',    sub: 'Log a scale reading' },
  [IMAGE_TYPE_EDUCATION]: { icon: '🎓',  label: 'Education', sub: 'Log a meeting / class' },
};

function UnknownCaptureModal({ isOpen, onClose, onPick }) {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="unknown-capture-title"
      data-testid="unknown-capture-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="unknown-capture-title"
          className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100"
        >
          What's in this photo?
        </h2>
        <p className="mb-5 text-sm text-gray-600 dark:text-gray-400">
          We couldn't tell what this image is. Pick a category to log it manually.
        </p>

        <div className="flex flex-col gap-2">
          {USER_SELECTABLE_TYPES.map((type) => {
            const opt = OPTION_LABELS[type];
            return (
              <button
                key={type}
                type="button"
                data-testid={`unknown-capture-pick-${type}`}
                onClick={() => onPick(type)}
                className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 text-left hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-gray-700 dark:hover:bg-gray-800"
              >
                <span className="text-2xl" aria-hidden="true">{opt.icon}</span>
                <span className="flex-1">
                  <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                    {opt.label}
                  </span>
                  <span className="block text-xs text-gray-500 dark:text-gray-400">
                    {opt.sub}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          data-testid="unknown-capture-cancel"
          onClick={onClose}
          className="mt-4 w-full rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default UnknownCaptureModal;
