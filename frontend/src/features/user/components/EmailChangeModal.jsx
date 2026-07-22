// Email change OTP verification modal.
import React, { useEffect, useState } from 'react';
import { Loader, Mail, ShieldCheck, X } from 'lucide-react';
import useOtpInput from '../hooks/useOtpInput';
import useResendCountdown from '../hooks/useResendCountdown';
import { verifyOtp } from '../services/authService';
import { requestEmailChange, confirmEmailChange } from '../services/emailChangeService';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';
import NativeInput, { otpAutoCompleteForCell } from '../../../shared/components/NativeInput.jsx';

const EmailChangeModal = ({
  isOpen,
  onClose,
  userId,
  currentEmail,
  newEmail,
  onEmailUpdated,
}) => {
  const otpCtl = useOtpInput(6);
  const resend = useResendCountdown(0, isOpen);
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const resetState = () => {
    otpCtl.reset();
    setErrorMessage('');
    setSuccessMessage('');
    setOtpSending(false);
    setOtpVerifying(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const doSendOtp = async () => {
    setOtpSending(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      await requestEmailChange({ userId, currentEmail, newEmail });
      resend.start(60);
      return true;
    } catch (err) {
      setErrorMessage(err.message || 'Failed to send OTP. Please try again.');
      return false;
    } finally {
      setOtpSending(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return undefined;
    resetState();
    doSendOtp();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- send once when modal opens
  }, [isOpen, newEmail, currentEmail, userId]);

  const handleResendOtp = async () => {
    otpCtl.reset();
    await doSendOtp();
  };

  const handleVerifyOtp = async () => {
    if (!otpCtl.isComplete) return;
    setOtpVerifying(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const verifyResult = await verifyOtp(newEmail, otpCtl.value, 'email_change', 'email');
      if (!verifyResult.success) {
        setErrorMessage(verifyResult.message || 'Invalid OTP. Please try again.');
        return;
      }

      const changeResult = await confirmEmailChange({ userId, currentEmail, newEmail });
      setSuccessMessage(changeResult.message || 'Email updated successfully.');
      onEmailUpdated?.(newEmail);
      setTimeout(handleClose, 1500);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to update email. Please try again.');
    } finally {
      setOtpVerifying(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white w-full sm:max-w-sm sm:rounded-2xl rounded-t-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92dvh]">
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>
        <div className="bg-green-50 px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-green-700" />
              <h2 className="text-base font-bold text-green-800">Verify New Email</h2>
            </div>
            <TouchFeedbackButton onClick={handleClose} className="p-1.5 rounded-full hover:bg-green-100" ariaLabel="Close">
              <X className="h-4 w-4 text-green-700" />
            </TouchFeedbackButton>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-5">
          <div className="flex justify-center mb-3">
            <div className="h-14 w-14 rounded-full bg-green-50 flex items-center justify-center">
              <Mail className="h-7 w-7 text-green-600" />
            </div>
          </div>
          <p className="text-sm text-gray-700 text-center mb-1">
            Enter the 6-digit code sent to:
          </p>
          <p className="text-sm font-semibold text-gray-900 text-center mb-5 truncate px-2">
            {newEmail}
          </p>

          {otpSending && !otpCtl.isComplete ? (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-gray-500">
              <Loader className="h-4 w-4 animate-spin" />
              Sending verification code...
            </div>
          ) : (
            <>
              <div className="flex justify-center gap-2 mb-3" onPaste={otpCtl.handlePaste}>
                {otpCtl.otp.map((digit, i) => (
                  <NativeInput
                    key={i}
                    otp
                    ref={(el) => { otpCtl.refs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete={otpAutoCompleteForCell(i)}
                    maxLength={1}
                    value={digit}
                    onChange={(e) => otpCtl.handleChange(i, e.target.value)}
                    onKeyDown={(e) => otpCtl.handleKeyDown(i, e)}
                    className="w-11 h-12 text-center text-lg font-bold border-2 rounded-xl focus:outline-none focus:border-green-500 transition-colors text-[16px]"
                    style={{ borderColor: digit ? '#16a34a' : '#e5e7eb' }}
                  />
                ))}
              </div>
              <div className="text-center mb-3">
                {resend.canResend ? (
                  <TouchFeedbackButton
                    onClick={handleResendOtp}
                    disabled={otpSending}
                    className="text-xs text-green-700 font-semibold underline disabled:opacity-50"
                    ariaLabel="Resend OTP"
                  >
                    {otpSending ? 'Sending...' : 'Resend OTP'}
                  </TouchFeedbackButton>
                ) : (
                  <p className="text-xs text-gray-400">
                    Resend OTP in <span className="font-semibold text-gray-600">{resend.countdown}s</span>
                  </p>
                )}
              </div>
            </>
          )}

          {errorMessage && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <p className="text-xs text-red-600">{errorMessage}</p>
            </div>
          )}
          {successMessage && (
            <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <p className="text-xs text-green-700">{successMessage}</p>
            </div>
          )}
        </div>

        <div
          className="flex gap-3 px-5 pt-3 pb-5 border-t border-gray-100 bg-white"
          style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
        >
          <TouchFeedbackButton
            onClick={handleClose}
            className="flex-1 py-3 px-4 rounded-xl border-2 border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50"
            ariaLabel="Cancel"
          >
            Cancel
          </TouchFeedbackButton>
          <TouchFeedbackButton
            onClick={handleVerifyOtp}
            disabled={!otpCtl.isComplete || otpVerifying || otpSending}
            className={`flex-1 py-3 px-4 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-1.5 ${
              otpCtl.isComplete && !otpVerifying && !otpSending
                ? 'bg-green-600 hover:bg-green-700 shadow-lg'
                : 'bg-gray-300 cursor-not-allowed'
            }`}
            ariaLabel="Verify and update email"
          >
            {otpVerifying ? (
              <>
                <Loader className="h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4" />
                Verify Email
              </>
            )}
          </TouchFeedbackButton>
        </div>
      </div>
    </div>
  );
};

export default EmailChangeModal;
