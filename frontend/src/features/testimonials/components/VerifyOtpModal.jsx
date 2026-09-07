/**
 * VerifyOtpModal.jsx
 * Coach enters the 4-digit OTP (received by email) to verify a member's testimonial.
 */
import React, { useState } from 'react';
import { ShieldCheck, X } from 'lucide-react';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';
import NativeInput from '../../../shared/components/NativeInput.jsx';
import { verifyTestimonialOtp } from '../services/testimonialApi.js';
import {
  EMAIL_OTP_LENGTH,
  extractOtpFromText,
  isValidEmailOtp,
} from '../../user/domain/otpLength';

export default function VerifyOtpModal({ testimonialId, memberName, onVerified, onClose }) {
  const [otp,        setOtp]        = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState(null);

  const handleOtpInput = (raw) => {
    const extracted = extractOtpFromText(raw, EMAIL_OTP_LENGTH);
    setOtp(extracted ?? String(raw ?? '').replace(/\D/g, '').slice(0, EMAIL_OTP_LENGTH));
    setError(null);
  };

  const handleVerify = async () => {
    setError(null);
    if (!isValidEmailOtp(otp.trim())) {
      setError('Please enter the 4-digit OTP from the email');
      return;
    }
    setSubmitting(true);
    try {
      await verifyTestimonialOtp({ testimonialId, otp: otp.trim() });
      onVerified();
    } catch (err) {
      setError(err.message || 'Verification failed. Please check the OTP and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-t-3xl w-full max-w-lg p-6 space-y-5 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-green-600" />
            <h2 className="text-base font-bold text-gray-800">Verify Testimonial</h2>
          </div>
          <TouchFeedbackButton
            onClick={onClose}
            className="p-1.5 rounded-full text-gray-500 hover:text-gray-700"
            ariaLabel="Close"
          >
            <X className="h-5 w-5" />
          </TouchFeedbackButton>
        </div>

        <p className="text-sm text-gray-600">
          Enter the 4-digit OTP from the email to verify{' '}
          <strong>{memberName}</strong>'s testimonial.
        </p>

        {/* OTP input */}
        <NativeInput
          otp
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="one-time-code"
          maxLength={EMAIL_OTP_LENGTH}
          placeholder="_ _ _ _"
          value={otp}
          onChange={(e) => handleOtpInput(e.target.value)}
          onPaste={(e) => {
            e.preventDefault();
            handleOtpInput(e.clipboardData?.getData('text') ?? '');
          }}
          className="w-full text-center text-3xl font-bold tracking-[0.5em] border-2 border-gray-300 rounded-2xl py-4 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400"
          autoFocus
        />

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <TouchFeedbackButton
          onClick={handleVerify}
          disabled={submitting || otp.length !== EMAIL_OTP_LENGTH}
          className="w-full py-3.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-bold transition-colors disabled:opacity-60"
        >
          {submitting ? 'Verifying…' : 'Verify & Approve'}
        </TouchFeedbackButton>
      </div>
    </div>
  );
}
