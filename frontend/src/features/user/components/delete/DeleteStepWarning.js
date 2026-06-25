// Step 1 — Warning screen with bullet list of what will be lost.
import React from 'react';
import { AlertTriangle, Loader, Mail, X } from 'lucide-react';
import TouchFeedbackButton from '../../../../shared/components/TouchFeedbackButton';

const ITEMS = [
  'Your profile and personal information',
  'All nutrition analysis and food history',
  'Weight records and progress data',
  'Education and wellness activity logs',
  'All other app data associated with your account',
];

const DeleteStepWarning = ({ onClose, onContinue, sending, errorMessage }) => (
  <>
    <div className="flex justify-center pt-3 pb-1 sm:hidden">
      <div className="w-10 h-1 rounded-full bg-gray-300" />
    </div>
    <div className="bg-red-50 px-5 pt-4 pb-4 border-b border-red-100">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
          <AlertTriangle className="h-5 w-5 text-red-600" />
        </div>
        <div>
          <h2 className="text-base font-bold text-red-700">Delete Account</h2>
          <p className="text-xs text-red-600 mt-0.5">This action is permanent and cannot be undone.</p>
        </div>
        <TouchFeedbackButton onClick={onClose} className="ml-auto p-1.5 rounded-full hover:bg-red-100 flex-shrink-0" ariaLabel="Close">
          <X className="h-4 w-4 text-red-400" />
        </TouchFeedbackButton>
      </div>
    </div>
    <div className="overflow-y-auto flex-1 px-5 py-4">
      <p className="text-sm text-gray-700 font-medium mb-3">Deleting your account will permanently remove:</p>
      <ul className="space-y-1.5 mb-4">
        {ITEMS.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
            <span className="mt-0.5 h-4 w-4 rounded-full bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0 text-[10px] font-bold">✕</span>
            {item}
          </li>
        ))}
      </ul>
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-2">
        <p className="text-xs text-amber-700"><strong>⚠️ Note:</strong> Once deleted, your account and all data cannot be recovered.</p>
      </div>
      {errorMessage && (
        <div className="mt-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <p className="text-xs text-red-600">{errorMessage}</p>
        </div>
      )}
    </div>
    <div className="flex gap-3 px-5 pt-3 pb-5 border-t border-gray-100 bg-white" style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
      <TouchFeedbackButton onClick={onClose} className="flex-1 py-3 px-4 rounded-xl border-2 border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50" ariaLabel="Cancel">Cancel</TouchFeedbackButton>
      <TouchFeedbackButton onClick={onContinue} disabled={sending}
        className="flex-1 py-3 px-4 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 flex items-center justify-center gap-1.5 disabled:opacity-60"
        ariaLabel="Continue">
        {sending ? <><Loader className="h-4 w-4 animate-spin" /> Sending...</> : <><Mail className="h-4 w-4" /> Continue</>}
      </TouchFeedbackButton>
    </div>
  </>
);

export default DeleteStepWarning;
