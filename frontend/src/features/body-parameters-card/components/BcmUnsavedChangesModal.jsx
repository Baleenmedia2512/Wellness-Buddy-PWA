/**
 * BcmUnsavedChangesModal.jsx
 *
 * Shown when closing the BCM form with unsaved field edits.
 * Cursor-style layout with BCM green branding: Keep editing · Discard changes
 */
import React from 'react';

/**
 * @param {{
 *   isOpen: boolean,
 *   isSaving?: boolean,
 *   onDiscard: () => void,
 *   onKeepEditing: () => void,
 * }} props
 */
export default function BcmUnsavedChangesModal({
  isOpen,
  isSaving = false,
  onDiscard,
  onKeepEditing,
}) {
  if (!isOpen) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="bcm-unsaved-title"
      aria-describedby="bcm-unsaved-desc"
      className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/55"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSaving) onKeepEditing();
      }}
    >
      <div
        className="w-full max-w-[420px] overflow-hidden rounded-[10px] border border-green-700/40 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-green-100 bg-gradient-to-r from-green-600 to-green-600 px-4 py-3.5">
          <h2
            id="bcm-unsaved-title"
            className="m-0 text-sm font-semibold leading-snug text-white"
          >
            Unsaved changes
          </h2>
        </div>

        {/* Body */}
        <div className="border-b border-green-100 px-4 py-4">
          <p
            id="bcm-unsaved-desc"
            className="m-0 text-[13px] font-normal leading-relaxed text-gray-600"
          >
            You have unsaved changes. Are you sure you want to discard them?
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-4 py-3">
          <button
            type="button"
            disabled={isSaving}
            onClick={onKeepEditing}
            className="rounded-md border border-green-600 bg-gradient-to-r from-green-600 to-green-600 px-3.5 py-1.5 text-[13px] font-medium text-white disabled:opacity-50"
          >
            Keep editing
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={onDiscard}
            className="rounded-md border border-red-500 bg-red-500 px-3.5 py-1.5 text-[13px] font-medium text-white disabled:opacity-50 hover:bg-red-600"
          >
            Discard changes
          </button>
        </div>
      </div>
    </div>
  );
}
