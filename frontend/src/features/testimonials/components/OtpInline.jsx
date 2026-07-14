/**
 * Inline OTP entry for photo or video testimonial verification.
 */
import React, { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';
import { verifyTestimonialOtp, verifyTestimonialVideoOtp } from '../services/testimonialApi.js';

/**
 * @param {{ testimonialId: number, type: 'photo'|'video', onVerified: () => void, className?: string }} props
 */
export default function OtpInline({ testimonialId, type, onVerified, className = '' }) {
  const [otp,     setOtp]     = useState('');
  const [loading, setLoading] = useState(false);
  const [err,     setErr]     = useState(null);

  const submit = async () => {
    setErr(null);
    if (!/^\d{6}$/.test(otp.trim())) {
      setErr('Enter the 6-digit OTP from your coach');
      return;
    }
    setLoading(true);
    try {
      if (type === 'photo') {
        await verifyTestimonialOtp({ testimonialId, otp: otp.trim() });
      } else {
        await verifyTestimonialVideoOtp({ testimonialId, otp: otp.trim() });
      }
      onVerified();
    } catch (e) {
      setErr(e.message || 'Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3 ${className}`}>
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-amber-600 shrink-0" />
        <p className="text-sm font-semibold text-amber-800">Enter OTP from your coach</p>
      </div>
      <p className="text-xs text-amber-700 leading-relaxed">
        Your coach received a 6-digit verification code by email. Ask them to share it with you.
      </p>
      <input
        type="tel"
        inputMode="numeric"
        maxLength={6}
        placeholder="_ _ _ _ _ _"
        value={otp}
        onChange={(e) => { setOtp(e.target.value.replace(/\D/g, '').slice(0, 6)); setErr(null); }}
        className="w-full text-center text-2xl font-bold tracking-[0.4em] border-2 border-amber-300 rounded-xl py-3 focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
      />
      {err && <p className="text-xs text-red-600 text-center">{err}</p>}
      <TouchFeedbackButton
        onClick={submit}
        disabled={loading || otp.length !== 6}
        className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold disabled:opacity-60 transition-colors"
      >
        {loading ? 'Verifying…' : 'Verify with OTP'}
      </TouchFeedbackButton>
    </div>
  );
}
