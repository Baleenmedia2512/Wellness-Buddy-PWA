// Step 2 — OTP verification.
import React from 'react';
import { Loader, Mail, ShieldCheck, X } from 'lucide-react';
import TouchFeedbackButton from '../../../../shared/components/TouchFeedbackButton';
import OtpInputCells from '../../../../shared/components/OtpInputCells.jsx';
import { EMAIL_OTP_LENGTH } from '../../domain/otpLength';

const DeleteStepOtp = ({
  userEmail, otpCtl, onVerify, verifying,
  countdown, canResend, onResend, sending,
  errorMessage, onBack, onClose,
}) => {
  return (
    <>
      <div className="flex justify-center pt-3 pb-1 sm:hidden"><div className="w-10 h-1 rounded-full bg-gray-300" /></div>
      <div className="bg-red-50 px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-red-600" />
            <h2 className="text-base font-bold text-red-600">Verify Your Identity</h2>
          </div>
          <TouchFeedbackButton onClick={onClose} className="p-1.5 rounded-full hover:bg-red-100" ariaLabel="Close">
            <X className="h-4 w-4 text-red-600" />
          </TouchFeedbackButton>
        </div>
      </div>
      <div className="overflow-y-auto flex-1 px-5 py-5">
        <div className="flex justify-center mb-3">
          <div className="h-14 w-14 rounded-full bg-red-50 flex items-center justify-center"><Mail className="h-7 w-7 text-red-500" /></div>
        </div>
        <p className="text-sm text-gray-700 text-center mb-1">We sent a 4-digit OTP to:</p>
        <p className="text-sm font-semibold text-gray-900 text-center mb-5 truncate px-2">{userEmail}</p>
        <OtpInputCells
          otpCtl={otpCtl}
          length={EMAIL_OTP_LENGTH}
          emailOtp
          className="flex justify-center gap-2 mb-3"
          cellClassName="w-11 h-12 text-center text-lg font-bold border-2 rounded-xl focus:outline-none focus:border-red-500 transition-colors text-[16px]"
          cellStyle={(digit) => ({ borderColor: digit ? '#dc2626' : '#e5e7eb' })}
        />
        <div className="text-center mb-3">
          {canResend ? (
            <TouchFeedbackButton onClick={onResend} disabled={sending} className="text-xs text-red-600 font-semibold underline disabled:opacity-50" ariaLabel="Resend OTP">
              {sending ? 'Sending...' : 'Resend OTP'}
            </TouchFeedbackButton>
          ) : (
            <p className="text-xs text-gray-400">Resend OTP in <span className="font-semibold text-gray-600">{countdown}s</span></p>
          )}
        </div>
        {errorMessage && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2"><p className="text-xs text-red-600">{errorMessage}</p></div>
        )}
      </div>
      <div className="flex gap-3 px-5 pt-3 pb-5 border-t border-gray-100 bg-white" style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
        <TouchFeedbackButton onClick={onBack} className="flex-1 py-3 px-4 rounded-xl border-2 border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50" ariaLabel="Back">Back</TouchFeedbackButton>
        <TouchFeedbackButton onClick={onVerify} disabled={!otpCtl.isComplete || verifying}
          className={`flex-1 py-3 px-4 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-1.5 ${otpCtl.isComplete && !verifying ? 'bg-red-600 hover:bg-red-700 shadow-lg' : 'bg-gray-300 cursor-not-allowed'}`}
          ariaLabel="Verify OTP">
          {verifying ? <><Loader className="h-4 w-4 animate-spin" /> Verifying...</> : <><ShieldCheck className="h-4 w-4" /> Verify OTP</>}
        </TouchFeedbackButton>
      </div>
    </>
  );
};

export default DeleteStepOtp;
