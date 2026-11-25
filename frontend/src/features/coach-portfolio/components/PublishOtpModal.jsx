/**
 * Member enters the 4-digit OTP emailed to their coach to publish a website.
 */
import React, { useState } from 'react';
import { Link2, Mail, ShieldCheck, X } from 'lucide-react';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';
import NativeInput from '../../../shared/components/NativeInput.jsx';
import {
  EMAIL_OTP_LENGTH,
  extractOtpFromText,
  isValidEmailOtp,
} from '../../user/domain/otpLength';
import { verifyPortfolioPublishOtp } from '../services/portfolioApi';

export default function PublishOtpModal({
  userId,
  centerId,
  otpKey = null,
  maskedEmail,
  coachName,
  publicPathPreview,
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
      const data = await verifyPortfolioPublishOtp({
        userId,
        centerId,
        otpKey,
        otp: otp.trim(),
      });
      onVerified(data);
    } catch (err) {
      setError(err?.message || 'Verification failed. Please check the OTP and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="coach-publish-otp-title"
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
                <h2 id="coach-publish-otp-title" className="text-[15px] font-bold tracking-tight">
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
                  (<span className="font-semibold text-white">{maskedEmail}</span>)
                </>
              ) : null}
              {' '}
              for the 4-digit code.
            </p>
          </div>
        </div>

        <div className="space-y-4 px-5 py-5">
          {publicPathPreview ? (
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 px-3.5 py-3">
              <p className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800">
                <Link2 className="h-3.5 w-3.5" aria-hidden />
                Publishes at
              </p>
              <p className="break-all font-mono text-[13px] font-semibold leading-snug text-emerald-950">
                {publicPathPreview}
              </p>
            </div>
          ) : null}

          <div>
            <label
              htmlFor="coach-publish-otp-input"
              className="mb-2 block text-center text-[12px] font-semibold text-slate-600"
            >
              Enter 4-digit code
            </label>
            <NativeInput
              id="coach-publish-otp-input"
              otp
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
              maxLength={EMAIL_OTP_LENGTH}
              placeholder="••••"
              value={otp}
              onChange={(e) => handleOtpInput(e.target.value)}
              onPaste={(e) => {
                e.preventDefault();
                handleOtpInput(e.clipboardData?.getData('text') ?? '');
              }}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 text-center text-[28px] font-bold tracking-[0.55em] text-slate-900 outline-none transition placeholder:tracking-[0.35em] placeholder:text-slate-300 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/15"
              autoFocus
            />
          </div>

          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-center text-[13px] text-rose-700">
              {error}
            </div>
          ) : null}

          <TouchFeedbackButton
            onClick={handleVerify}
            disabled={submitting || otp.length !== EMAIL_OTP_LENGTH}
            className="w-full rounded-2xl bg-emerald-600 py-3.5 text-sm font-bold text-white shadow-sm shadow-emerald-600/25 transition hover:bg-emerald-700 disabled:opacity-50"
          >
            {submitting ? 'Publishing…' : 'Verify & publish'}
          </TouchFeedbackButton>

          {typeof onResend === 'function' ? (
            <div className="pb-1 text-center">
              <TouchFeedbackButton
                onClick={onResend}
                disabled={resending || submitting}
                className="text-[13px] font-semibold text-emerald-700 underline-offset-2 hover:underline disabled:opacity-50"
              >
                {resending ? 'Sending…' : 'Resend code to coach'}
              </TouchFeedbackButton>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
