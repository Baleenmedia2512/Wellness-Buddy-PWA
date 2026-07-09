/**
 * TestimonialVideoStatusCard.jsx
 * Shows the member's result-video status and OTP verification flow.
 */
import React, { useState } from 'react';
import { AlertCircle, CheckCircle, Clock, ShieldCheck, Video } from 'lucide-react';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';
import { verifyTestimonialVideoOtp } from '../services/testimonialApi.js';

const STATUS_CONFIG = {
  pending: {
    label: 'Pending Coach Verification',
    badgeClass: 'bg-amber-100 text-amber-800',
    Icon: Clock,
  },
  verified: {
    label: 'Verified',
    badgeClass: 'bg-green-100 text-green-800',
    Icon: CheckCircle,
  },
  none: {
    label: 'Not Uploaded',
    badgeClass: 'bg-red-100 text-red-800',
    Icon: AlertCircle,
  },
};

export default function TestimonialVideoStatusCard({ video, onVerified }) {
  const [otp, setOtp] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [otpError, setOtpError] = useState(null);
  const [showOtpBox, setShowOtpBox] = useState(false);

  if (!video || video.videoStatus === 'none') return null;

  const cfg = STATUS_CONFIG[video.videoStatus] || STATUS_CONFIG.none;
  const StatusIcon = cfg.Icon;

  const handleVerify = async () => {
    setOtpError(null);
    if (!/^\d{6}$/.test(otp.trim())) {
      setOtpError('Enter the 6-digit OTP your coach shared with you');
      return;
    }
    setVerifying(true);
    try {
      await verifyTestimonialVideoOtp({ testimonialId: video.testimonialId, otp: otp.trim() });
      setShowOtpBox(false);
      setOtp('');
      if (onVerified) onVerified();
    } catch (err) {
      setOtpError(err.message || 'Invalid OTP. Ask your coach to share it again.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-gray-800">Your Result Videos</h2>
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${cfg.badgeClass}`}>
          <StatusIcon className="h-3.5 w-3.5" /> {cfg.label}
        </span>
      </div>

      <div className="flex gap-2 flex-wrap text-xs">
        {video.hasHealthVideo && (
          <span className="flex items-center gap-1 bg-green-50 border border-green-200 rounded-full px-2.5 py-1 text-gray-700 font-medium">
            <Video className="h-3 w-3 text-green-600" /> Health Results
          </span>
        )}
        {video.hasBusinessVideo && (
          <span className="flex items-center gap-1 bg-blue-50 border border-blue-200 rounded-full px-2.5 py-1 text-gray-700 font-medium">
            <Video className="h-3 w-3 text-blue-600" /> Business Results
          </span>
        )}
      </div>

      {video.videoStatus === 'verified' && video.videoVerifiedAt && (
        <p className="text-xs text-green-600 font-medium">
          ✅ Verified on {new Date(video.videoVerifiedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
      )}

      {video.videoStatus === 'pending' && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
          <p className="text-sm text-amber-800 font-medium">
            📧 Your coach received a verification email with a 6-digit OTP.
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
              <input
                type="tel"
                inputMode="numeric"
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
    </div>
  );
}
