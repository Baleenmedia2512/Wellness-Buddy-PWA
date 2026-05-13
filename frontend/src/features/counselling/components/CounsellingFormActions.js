/**
 * CounsellingFormActions.js — presentational.
 * Footer with Clear/Submit buttons and validation hint.
 */
import React from 'react';
import { Save } from 'lucide-react';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';

export default function CounsellingFormActions({ isSaving, canSubmit, isValid, onReset }) {
  return (
    <>
      <div className="border-t pt-4 sm:pt-6 flex flex-col sm:flex-row gap-2 sm:gap-3">
        <TouchFeedbackButton
          type="button"
          onClick={onReset}
          variant="outline"
          className="w-full sm:flex-1 px-4 sm:px-6 py-2.5 sm:py-3 border-2 border-gray-300 text-gray-700 rounded-lg text-sm sm:text-base font-medium hover:bg-gray-50"
        >
          Clear All
        </TouchFeedbackButton>
        <TouchFeedbackButton
          type="submit"
          disabled={!canSubmit}
          className={`
            w-full sm:flex-1 px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg text-sm sm:text-base font-medium flex items-center justify-center gap-2
            ${
              !canSubmit
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700'
            }
          `}
        >
          {isSaving ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              Saving...
            </>
          ) : (
            <>
              <Save size={20} />
              Save Assessment
            </>
          )}
        </TouchFeedbackButton>
      </div>

      {!isValid && (
        <p className="text-xs sm:text-sm text-amber-600 text-center px-2">
          Please select at least one health problem to continue
        </p>
      )}
    </>
  );
}
