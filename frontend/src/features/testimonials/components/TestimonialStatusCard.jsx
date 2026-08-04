/**
 * TestimonialStatusCard.jsx
 * Shows the member's current testimonial summary + status badge.
 * When status is "pending", the member enters the OTP that their coach
 * shared with them (coach received it by email after submission).
 */
import React, { useState } from 'react';
import { CheckCircle, Clock, Pencil, ShieldCheck } from 'lucide-react';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';
import NativeInput from '../../../shared/components/NativeInput.jsx';
import { verifyTestimonialOtp } from '../services/testimonialApi.js';
import { PORTRAIT_IMAGE_CLASS_SM } from '../services/testimonialFormUtils.js';

function StatusBadge({ status }) {
  if (status === 'verified') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-100 text-green-800 text-xs font-bold">
        <CheckCircle className="h-3.5 w-3.5" /> Verified
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold">
      <Clock className="h-3.5 w-3.5" /> Pending Sponsor Verification
    </span>
  );
}

export default function TestimonialStatusCard({ testimonial, onEdit, onAddAfter, onVerified }) {
  const [otp,        setOtp]        = useState('');
  const [verifying,  setVerifying]  = useState(false);
  const [otpError,   setOtpError]   = useState(null);
  const [showOtpBox, setShowOtpBox] = useState(false);

  if (!testimonial) return null;

  const diff      = Math.abs(testimonial.afterWeightKg - testimonial.beforeWeightKg).toFixed(1);
  const arrow     = testimonial.goalType === 'loss' ? '↓' : '↑';
  const goalLabel = testimonial.goalType === 'loss' ? 'Weight Loss' : 'Weight Gain';

  const handleVerify = async () => {
    setOtpError(null);
    if (!/^\d{6}$/.test(otp.trim())) {
      setOtpError('Enter the 6-digit OTP your sponsor shared with you');
      return;
    }
    setVerifying(true);
    try {
      await verifyTestimonialOtp({ testimonialId: testimonial.id, otp: otp.trim() });
      setShowOtpBox(false);
      setOtp('');
      if (onVerified) onVerified();
    } catch (err) {
      setOtpError(err.message || 'Invalid OTP. Ask your sponsor to share it again.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-gray-800">Your Testimonial</h2>
        <StatusBadge status={testimonial.status} />
      </div>

      {/* Before / After photos */}
      {(testimonial.beforeImageUrl || testimonial.afterImageUrl) && (
        <div className="flex gap-3">
          {testimonial.beforeImageUrl && (
            <div className="flex-1 text-center">
              <img
                src={testimonial.beforeImageUrl}
                alt="Before"
                className={PORTRAIT_IMAGE_CLASS_SM}
                loading="lazy"
              />
              <p className="text-xs text-gray-500 mt-1 font-semibold">BEFORE</p>
            </div>
          )}
          {testimonial.afterImageUrl && (
            <div className="flex-1 text-center">
              <img
                src={testimonial.afterImageUrl}
                alt="After"
                className={PORTRAIT_IMAGE_CLASS_SM}
                loading="lazy"
              />
              <p className="text-xs text-gray-500 mt-1 font-semibold">AFTER</p>
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-gray-50 rounded-xl p-2">
          <p className="text-[10px] text-gray-500 font-semibold uppercase">Before</p>
          <p className="text-sm font-bold text-gray-800">{testimonial.beforeWeightKg} kg</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-2">
          <p className="text-[10px] text-gray-500 font-semibold uppercase">After</p>
          <p className="text-sm font-bold text-gray-800">{testimonial.afterWeightKg} kg</p>
        </div>
        <div className="bg-green-50 rounded-xl p-2">
          <p className="text-[10px] text-gray-500 font-semibold uppercase">Change</p>
          <p className="text-sm font-bold text-green-700">{arrow} {diff} kg</p>
        </div>
      </div>

      {testimonial.medicalCondition ? (
        <div className="bg-green-50 border border-green-100 rounded-xl px-3 py-2 text-left">
          <p className="text-[10px] text-gray-500 font-semibold uppercase">Medical Condition</p>
          <p className="text-sm font-semibold text-gray-800">{testimonial.medicalCondition}</p>
        </div>
      ) : null}

      <div className="flex gap-2 text-xs text-gray-600">
        <span className="bg-gray-100 rounded-full px-3 py-1 font-medium">{goalLabel}</span>
        <span className="bg-gray-100 rounded-full px-3 py-1 font-medium">⏱ {testimonial.durationText}</span>
      </div>

      {testimonial.status === 'verified' && testimonial.verifiedAt && (
        <p className="text-xs text-green-600 font-medium">
          ✅ Verified on {new Date(testimonial.verifiedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
      )}

      {/* ── Incomplete: prompt to add after photo ─────────────────────────── */}
      {testimonial.status === 'incomplete' && onAddAfter && (
        <TouchFeedbackButton
          onClick={onAddAfter}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-bold transition-colors"
        >
          <CheckCircle className="h-4 w-4" />
          Add After Photo &amp; Complete
        </TouchFeedbackButton>
      )}

      {/* ── OTP section — member enters OTP shared by coach ─────────────── */}
      {testimonial.status === 'pending' && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
          <p className="text-sm text-amber-800 font-medium">
            📧 Your sponsor received a verification email with a 6-digit OTP.
            Ask them to share it with you, then enter it below.
          </p>
          {!showOtpBox ? (
            <TouchFeedbackButton
              onClick={() => setShowOtpBox(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold transition-colors"
            >
              <ShieldCheck className="h-4 w-4" />
              I have the OTP — Enter it now
            </TouchFeedbackButton>
          ) : (
            <div className="space-y-3">
              <NativeInput
                otp
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                maxLength={6}
                placeholder="_ _ _ _ _ _"
                value={otp}
                onChange={(e) => {
                  setOtp(e.target.value.replace(/\D/g, '').slice(0, 6));
                  setOtpError(null);
                }}
                className="w-full text-center text-2xl font-bold tracking-[0.4em] border-2 border-amber-300 rounded-xl py-3 focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                autoFocus
              />
              {otpError && (
                <p className="text-xs text-red-600 text-center">{otpError}</p>
              )}
              <div className="flex gap-2">
                <TouchFeedbackButton
                  onClick={() => { setShowOtpBox(false); setOtp(''); setOtpError(null); }}
                  className="flex-1 py-2.5 rounded-xl border-2 border-gray-300 text-gray-600 text-sm font-semibold"
                >
                  Cancel
                </TouchFeedbackButton>
                <TouchFeedbackButton
                  onClick={handleVerify}
                  disabled={verifying || otp.length !== 6}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold transition-colors disabled:opacity-60"
                >
                  {verifying ? 'Verifying…' : 'Verify'}
                </TouchFeedbackButton>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit button — always available, resets to pending + new OTP to coach */}
      <TouchFeedbackButton
        onClick={onEdit}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-gray-300 text-gray-700 text-sm font-semibold hover:border-green-400 hover:text-green-700 transition-colors"
      >
        <Pencil className="h-4 w-4" />
        Edit Testimonial
      </TouchFeedbackButton>

      {testimonial.status === 'pending' && (
        <p className="text-xs text-gray-400 text-center">
          Editing resets verification — your sponsor gets a new OTP by email.
        </p>
      )}
    </div>
  );
}
