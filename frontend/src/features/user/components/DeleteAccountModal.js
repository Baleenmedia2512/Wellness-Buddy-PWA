// src/features/user/components/DeleteAccountModal.js
// Warning → type DELETE → purge by userId (no email OTP).
import React, { useEffect, useState } from 'react';
import useDeleteAccountFlow from '../hooks/useDeleteAccountFlow';
import { deleteAccountRequest, purgeLocalAfterDelete } from '../services/authService';
import { deleteFirebaseUser } from '../../../shared/services/firebase';
import * as Session from '../../../shared/services/sessionStorage.js';
import DeleteStepWarning from './delete/DeleteStepWarning';
import DeleteStepConfirm from './delete/DeleteStepConfirm';
import DeleteStepSuccess from './delete/DeleteStepSuccess';

const CONFIRM_WORD = 'DELETE';

const DeleteAccountModal = ({
  isOpen,
  onClose,
  userId = null,
  accountLabel = '',
  onAccountDeleted,
  onSignOut,
}) => {
  const flow = useDeleteAccountFlow({ isOpen });
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!isOpen) {
      flow.reset();
      setConfirmText('');
      setErrorMessage('');
      setIsDeleting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when modal closes
  }, [isOpen]);

  const isConfirmValid = confirmText.trim().toUpperCase() === CONFIRM_WORD;
  const resolvedUserId = userId || Session.getDbUserId() || null;

  const resetAll = () => {
    flow.reset();
    setConfirmText('');
    setErrorMessage('');
    setIsDeleting(false);
  };
  const handleClose = () => {
    resetAll();
    onClose();
  };

  const handleContinue = () => {
    setErrorMessage('');
    if (!resolvedUserId) {
      setErrorMessage('Unable to identify your account. Please re-login and try again.');
      return;
    }
    flow.setStep(2);
  };

  const handleDelete = async () => {
    if (!isConfirmValid) return;
    if (!resolvedUserId) {
      setErrorMessage('Unable to identify your account. Please re-login and try again.');
      return;
    }
    setIsDeleting(true);
    setErrorMessage('');
    try {
      const data = await deleteAccountRequest({
        userId: resolvedUserId,
        confirmPhrase: CONFIRM_WORD,
      });
      if (!data.success) {
        setErrorMessage(data.message || 'Failed to delete account.');
        return;
      }
      purgeLocalAfterDelete();
      try { await deleteFirebaseUser(); } catch (e) { console.warn('[Delete] firebase user delete:', e); }
      try { onSignOut?.(); } catch (e) { console.warn('[Delete] sign-out:', e); }
      flow.setStep(3);
    } catch {
      setErrorMessage('Network error. Please check your connection and try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen) return null;
  return (
    <div className={`fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4 backdrop-blur-sm transition-colors ${flow.step === 3 ? 'bg-black/90' : 'bg-black/60'}`}>
      <div className="bg-white w-full sm:max-w-sm sm:rounded-2xl rounded-t-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[90vh]">
        {flow.step === 1 && (
          <DeleteStepWarning
            onClose={handleClose}
            onContinue={handleContinue}
            sending={false}
            errorMessage={errorMessage}
          />
        )}
        {flow.step === 2 && (
          <DeleteStepConfirm
            accountLabel={accountLabel}
            confirmText={confirmText}
            setConfirmText={(v) => { setConfirmText(v); setErrorMessage(''); }}
            isConfirmValid={isConfirmValid}
            isDeleting={isDeleting}
            onDelete={handleDelete}
            onBack={() => { flow.setStep(1); setConfirmText(''); setErrorMessage(''); }}
            onClose={handleClose}
            errorMessage={errorMessage}
          />
        )}
        {flow.step === 3 && (
          <DeleteStepSuccess onDone={() => { resetAll(); onAccountDeleted?.(); }} />
        )}
      </div>
    </div>
  );
};

export default DeleteAccountModal;
