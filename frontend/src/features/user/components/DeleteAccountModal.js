// src/features/user/components/DeleteAccountModal.js
// Orchestrator — 4-step Apple Guideline 5.1.1(v) self-service deletion.
import React, { useEffect, useState } from 'react';
import useDeleteAccountFlow from '../hooks/useDeleteAccountFlow';
import useOtpInput from '../hooks/useOtpInput';
import useResendCountdown from '../hooks/useResendCountdown';
import { sendOtp, verifyOtp, deleteAccountRequest, purgeLocalAfterDelete } from '../services/authService';
import { deleteFirebaseUser } from '../../../shared/services/firebase';
import DeleteStepWarning from './delete/DeleteStepWarning';
import DeleteStepOtp from './delete/DeleteStepOtp';
import DeleteStepConfirm from './delete/DeleteStepConfirm';
import DeleteStepSuccess from './delete/DeleteStepSuccess';

const CONFIRM_WORD = 'DELETE';

const DeleteAccountModal = ({ isOpen, onClose, userEmail, onAccountDeleted, onSignOut }) => {
  const flow = useDeleteAccountFlow({ isOpen, userEmail });
  const otpCtl = useOtpInput(6);
  const resend = useResendCountdown(flow.restoredCountdown, flow.step === 2);

  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => { if (flow.step === 2) resend.start(flow.restoredCountdown); /* eslint-disable-next-line */ }, [flow.restoredCountdown]); // required by platform constraints; see inline context // required by platform constraints — see surrounding context

  const isConfirmValid = confirmText.trim().toUpperCase() === CONFIRM_WORD;

  const resetAll = () => {
    flow.reset(); otpCtl.reset(); setConfirmText(''); setErrorMessage('');
    setOtpSending(false); setOtpVerifying(false); setIsDeleting(false);
  };
  const handleClose = () => { resetAll(); onClose(); };

  const doSendOtp = async () => {
    setOtpSending(true); setErrorMessage('');
    try {
      const data = await sendOtp(userEmail);
      if (data.success) { flow.setStep(2); flow.markOtpSent(); resend.start(60); return true; }
      setErrorMessage(data.message || 'Failed to send OTP. Try again.');
    } catch { setErrorMessage('Network error. Please check your connection.'); }
    finally { setOtpSending(false); }
    return false;
  };
  const handleResendOtp = async () => { otpCtl.reset(); await doSendOtp(); };

  const handleVerifyOtp = async () => {
    if (!otpCtl.isComplete) return;
    setOtpVerifying(true); setErrorMessage('');
    try {
      const data = await verifyOtp(userEmail, otpCtl.value, 'delete');
      if (data.success) { flow.setStep(3); flow.markOtpVerified(); }
      else setErrorMessage(data.message || 'Invalid OTP. Please try again.');
    } catch { setErrorMessage('Network error. Please check your connection.'); }
    finally { setOtpVerifying(false); }
  };

  const handleDelete = async () => {
    if (!isConfirmValid) return;
    setIsDeleting(true); setErrorMessage('');
    try {
      const data = await deleteAccountRequest(userEmail);
      if (!data.success) { setErrorMessage(data.message || 'Failed to delete account.'); return; }
      purgeLocalAfterDelete();
      try { await deleteFirebaseUser(); } catch (e) { console.warn('[Delete] firebase user delete:', e); }
      try { onSignOut?.(); } catch (e) { console.warn('[Delete] sign-out:', e); }
      flow.setStep(4);
    } catch { setErrorMessage('Network error. Please check your connection and try again.'); }
    finally { setIsDeleting(false); }
  };

  if (!isOpen) return null;
  return (
    <div className={`fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4 backdrop-blur-sm transition-colors ${flow.step === 4 ? 'bg-black/90' : 'bg-black/60'}`}>
      <div className="bg-white w-full sm:max-w-sm sm:rounded-2xl rounded-t-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[90vh]">
        {flow.step === 1 && <DeleteStepWarning onClose={handleClose} onContinue={doSendOtp} sending={otpSending} errorMessage={errorMessage} />}
        {flow.step === 2 && <DeleteStepOtp userEmail={userEmail} otpCtl={otpCtl} onVerify={handleVerifyOtp}
          verifying={otpVerifying} countdown={resend.countdown} canResend={resend.canResend}
          onResend={handleResendOtp} sending={otpSending} errorMessage={errorMessage}
          onBack={() => { flow.setStep(1); otpCtl.reset(); setErrorMessage(''); }} onClose={handleClose} />}
        {flow.step === 3 && <DeleteStepConfirm userEmail={userEmail} confirmText={confirmText}
          setConfirmText={(v) => { setConfirmText(v); setErrorMessage(''); }}
          isConfirmValid={isConfirmValid} isDeleting={isDeleting} onDelete={handleDelete}
          onBack={() => { flow.setStep(2); setConfirmText(''); setErrorMessage(''); }} onClose={handleClose} errorMessage={errorMessage} />}
        {flow.step === 4 && <DeleteStepSuccess onDone={() => { resetAll(); onAccountDeleted?.(); }} />}
      </div>
    </div>
  );
};

export default DeleteAccountModal;
