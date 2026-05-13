// Step 3 — Type DELETE confirmation.
import React from 'react';
import { Loader, Trash2, X } from 'lucide-react';
import TouchFeedbackButton from '../../../../shared/components/TouchFeedbackButton';

const DeleteStepConfirm = ({
  userEmail, confirmText, setConfirmText,
  isConfirmValid, isDeleting, onDelete, onBack, onClose, errorMessage,
}) => (
  <>
    <div className="flex justify-center pt-3 pb-1 sm:hidden"><div className="w-10 h-1 rounded-full bg-gray-300" /></div>
    <div className="bg-red-50 px-5 py-4 border-b border-red-100">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-red-700">Final Confirmation</h2>
        <TouchFeedbackButton onClick={onClose} className="p-1.5 rounded-full hover:bg-red-100" ariaLabel="Close">
          <X className="h-4 w-4 text-red-400" />
        </TouchFeedbackButton>
      </div>
      <p className="text-xs text-red-500 mt-1 truncate">{userEmail}</p>
    </div>
    <div className="overflow-y-auto flex-1 px-5 py-5">
      <p className="text-sm text-gray-700 mb-4">
        To permanently delete your account, type{' '}
        <span className="font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">DELETE</span>{' '}
        in the box below:
      </p>
      <input
        type="text" value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        placeholder="Type DELETE here"
        className="w-full border-2 border-gray-200 rounded-xl px-4 py-3.5 text-[16px] font-mono text-center tracking-widest focus:outline-none focus:border-red-400 transition-colors"
        autoFocus autoCapitalize="characters" autoCorrect="off" spellCheck="false"
      />
      {errorMessage && (
        <div className="mt-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2"><p className="text-xs text-red-600">{errorMessage}</p></div>
      )}
    </div>
    <div className="flex gap-3 px-5 pt-3 pb-5 border-t border-gray-100 bg-white" style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
      <TouchFeedbackButton onClick={onBack} className="flex-1 py-3 px-4 rounded-xl border-2 border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50" ariaLabel="Back">Back</TouchFeedbackButton>
      <TouchFeedbackButton onClick={onDelete} disabled={!isConfirmValid || isDeleting}
        className={`flex-1 py-3 px-4 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-1.5 ${isConfirmValid && !isDeleting ? 'bg-red-600 hover:bg-red-700 shadow-lg' : 'bg-gray-300 cursor-not-allowed'}`}
        ariaLabel="Permanently delete account">
        {isDeleting ? <><Loader className="h-4 w-4 animate-spin" /> Deleting...</> : <><Trash2 className="h-4 w-4" /> Delete Account</>}
      </TouchFeedbackButton>
    </div>
  </>
);

export default DeleteStepConfirm;
