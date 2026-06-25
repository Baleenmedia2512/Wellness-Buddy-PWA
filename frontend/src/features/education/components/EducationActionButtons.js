/**
 * EducationActionButtons.js — presentational.
 * Action rows used by education modals: a destructive Delete button (detail
 * modal) and a Cancel/Save pair (manual entry modal).
 */
import React from 'react';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';

export function DeleteEducationButton({ onDelete, isDeleting }) {
  return (
    <TouchFeedbackButton
      disabled={isDeleting}
      className={`w-full flex items-center justify-center gap-2 rounded-lg text-white text-sm font-medium px-4 py-2 shadow-sm transition-all duration-200 ${
        isDeleting
          ? 'bg-red-400 cursor-not-allowed'
          : 'bg-red-500 hover:bg-red-600 hover:shadow-md active:scale-95'
      }`}
      onClick={onDelete}
    >
      {isDeleting ? (
        <>
          <span className="inline-block h-4 w-4 rounded-full border-2 border-white/70 border-t-white animate-spin" />
          Deleting…
        </>
      ) : (
        <>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Delete
        </>
      )}
    </TouchFeedbackButton>
  );
}

export function EducationFormActions({ onCancel, onSave, isSaving }) {
  return (
    <div className="flex gap-2 px-4 py-3 border-t border-gray-100">
      <button
        onClick={onCancel}
        disabled={isSaving}
        className="flex-1 px-4 py-2.5 border-2 border-gray-200 text-gray-600 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50"
      >
        Cancel
      </button>
      <button
        onClick={onSave}
        disabled={isSaving}
        className="flex-1 px-4 py-2.5 bg-blue-500 text-white rounded-xl text-sm font-semibold hover:bg-blue-600 active:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
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
          <>Log Session</>
        )}
      </button>
    </div>
  );
}
