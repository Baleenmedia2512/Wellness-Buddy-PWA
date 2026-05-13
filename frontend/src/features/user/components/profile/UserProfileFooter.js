// Cancel + Save footer used by UserProfileModal.
import React from 'react';
import { X, Save } from 'lucide-react';
import TouchFeedbackButton from '../../../../shared/components/TouchFeedbackButton';

const UserProfileFooter = ({ isSaving, hasSaved, disabled, onCancel, onSave }) => (
  <div className="flex items-center gap-3 p-6 border-t border-gray-200 bg-gray-50">
    <TouchFeedbackButton onClick={onCancel} disabled={isSaving} ariaLabel="Cancel"
      className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-white disabled:opacity-50 flex items-center justify-center gap-2">
      <X className="w-5 h-5" />{hasSaved ? 'Close' : 'Cancel'}
    </TouchFeedbackButton>
    <TouchFeedbackButton onClick={onSave} disabled={disabled} ariaLabel="Save profile"
      className="flex-1 px-6 py-3 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 disabled:opacity-50 shadow-lg flex items-center justify-center gap-2">
      {isSaving ? (
        <><div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />Saving...</>
      ) : (<><Save className="w-5 h-5" />Save</>)}
    </TouchFeedbackButton>
  </div>
);

export default UserProfileFooter;
