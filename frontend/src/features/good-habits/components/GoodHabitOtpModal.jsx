/**
 * Member enters the 4-digit OTP emailed to their coach to save Task by Coach.
 */
import React, { useState } from 'react';
import { Mail, ShieldCheck, X } from 'lucide-react';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';
import NativeInput from '../../../shared/components/NativeInput.jsx';
import {
  EMAIL_OTP_LENGTH,
  extractOtpFromText,
  isValidEmailOtp,
} from '../../user/domain/otpLength';
import { verifyGoodHabitOtp } from '../services/goodHabitApi';

export default function GoodHabitOtpModal({
  userId,
  otpKey,
  maskedEmail,
  coachName,
  onVerified,
  onResend,
  onClose,
  resending = false,
}) {
  const [otp, setOtp] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleOtpInput = (raw) => {
    const extracted = extractOtpFromText(raw, EMAIL_OTP_LENGTH);
    setOtp(extracted ?? String(raw ?? '').replace(/\D/g, '').slice(0, EMAIL_OTP_LENGTH));
    setError(null);
  };

  const handleVerify = async () => {
    setError(null);
    if (!isValidEmailOtp(otp.trim())) {
      setError('Please enter the 4-digit OTP from your coach');
      return;
    }
    setSubmitting(true);
    try {
      const data = await verifyGoodHabitOtp({
        userId,
        otpKey,
        otp: otp.trim(),
      });
      onVerified?.(data);
    } catch (err) {
      setError(err?.message || 'Verification failed. Please check the OTP and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[10080] flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="good-habit-otp-title"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close verification"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-t-3xl bg-white shadow-2xl shadow-slate-900/20 sm:rounded-3xl">
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 px-5 pb-5 pt-4 text-white">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
                <ShieldCheck className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <h2 id="good-habit-otp-title" className="text-[15px] font-bold tracking-tight">
                  Coach verification
                </h2>
                <p className="text-[11px] font-medium text-emerald-100/90">
                  Code sent to your coach
                </p>
              </div>
            </div>
            <TouchFeedbackButton
              onClick={onClose}
              className="rounded-full bg-white/10 p-2 text-white/90 hover:bg-white/20"
              ariaLabel="Close"
            >
              <X className="h-4 w-4" />
            </TouchFeedbackButton>
          </div>

          <div className="flex items-start gap-2.5 rounded-2xl bg-white/10 px-3.5 py-3 ring-1 ring-white/15">
            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-emerald-100" aria-hidden />
            <p className="text-[13px] leading-snug text-emerald-50">
              Ask{' '}
              <span className="font-semibold text-white">
                {coachName || 'your coach'}
              </span>
              {maskedEmail ? (
                <>
                  {' '}
                  (
                  <span className="font-medium text-white/95">{maskedEmail}</span>
                  )
                </>
              ) : null}
              {' '}
              for the 4-digit code (valid until 11:59:59 PM IST today). They got your photo and can share the code on WhatsApp.
            </p>
          </div>
        </div>

        <div className="space-y-4 px-5 py-5">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">
              Enter 4-digit code
            </span>
            <NativeInput
              otp
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
              maxLength={EMAIL_OTP_LENGTH}
              value={otp}
              onChange={(e) => handleOtpInput(e.target.value)}
              onPaste={(e) => {
                e.preventDefault();
                handleOtpInput(e.clipboardData?.getData('text') ?? '');
              }}
              placeholder="••••"
              className="w-full rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-center text-xl font-bold tracking-[0.35em] text-slate-900 outline-none ring-emerald-500/30 focus:ring-2"
              aria-label="4-digit coach OTP"
            />
          </label>

          {error ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700" role="alert">
              {error}
            </p>
          ) : null}

          <TouchFeedbackButton
            onClick={handleVerify}
            disabled={submitting || otp.length < EMAIL_OTP_LENGTH}
            className="w-full rounded-2xl bg-emerald-600 py-3.5 text-sm font-bold text-white shadow-sm disabled:opacity-50"
            ariaLabel="Verify and save Task by Coach"
          >
            {submitting ? 'Verifying…' : 'Verify & save'}
          </TouchFeedbackButton>

          {typeof onResend === 'function' ? (
            <button
              type="button"
              disabled={resending || submitting}
              onClick={onResend}
              className="w-full text-center text-xs font-semibold text-emerald-700 disabled:opacity-50"
            >
              {resending ? 'Resending…' : 'Resend code to coach'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
