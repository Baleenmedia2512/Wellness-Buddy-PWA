// Step 4 — Success screen.
import React from 'react';
import { CheckCircle } from 'lucide-react';
import TouchFeedbackButton from '../../../../shared/components/TouchFeedbackButton';

const DeleteStepSuccess = ({ onDone }) => (
  <div className="px-5 pt-8 pb-6 text-center" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
    <div className="flex justify-center mb-4">
      <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
        <CheckCircle className="h-8 w-8 text-green-600" />
      </div>
    </div>
    <h2 className="text-lg font-bold text-gray-900 mb-2">Account Deleted</h2>
    <p className="text-sm text-gray-600 mb-1">Your account has been permanently deleted.</p>
    <p className="text-xs text-gray-400 mb-6">All your personal data has been removed from our servers.</p>
    <TouchFeedbackButton onClick={onDone}
      className="w-full py-3.5 px-4 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700"
      ariaLabel="Done">Done</TouchFeedbackButton>
  </div>
);

export default DeleteStepSuccess;
