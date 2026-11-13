/**
 * Minimal consent UI: checkbox only (below Result Video).
 * Tick → OTP panel opens immediately → email OTP → after verify, checkbox stays checked.
 */
import React, { useEffect, useState } from 'react';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';
import NativeInput from '../../../shared/components/NativeInput.jsx';
import {
  EMAIL_OTP_LENGTH,
  extractOtpFromText,
  isValidEmailOtp,
} from '../../user/domain/otpLength';
import {
  requestDisplayConsentOtp,
  verifyDisplayConsentOtp,
  revokeDisplayConsent,
} from '../services/testimonialApi.js';

const CONSENT_COPY =
  'I agree to upload this document to display in website by all my Upline';

const OWNER_HINT =
  'If you own a coach website, verifying this also allows consented downlines to appear on your site.';

export default function WebsiteDisplayConsentCard({
  userId,
  testimonial,
  onChanged,
  showOwnerHint = true,
}) {
  const propConsented = Boolean(testimonial?.websiteDisplayConsentAt);
  const propAgreedPending = Boolean(testimonial?.websiteDisplayAgreed) && !propConsented;

  const [localConsented, setLocalConsented] = useState(propConsented);
  const [agreed, setAgreed] = useState(propConsented || propAgreedPending);
  const [otpOpen, setOtpOpen] = useState(propAgreedPending);
  const [otp, setOtp] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const photoVerified = testimonial?.status === 'verified';
  const videoVerified = testimonial?.videoStatus === 'verified';
  const canConsent = photoVerified || videoVerified;
  const consented = localConsented || propConsented;

  useEffect(() => {
    if (propConsented) {
      setLocalConsented(true);
      setAgreed(true);
      setOtpOpen(false);
      setOtp('');
      setError(null);
      return;
    }
    // Agreed on server but OTP not verified yet — keep the OTP panel visible
    // (e.g. after a parent refresh mid-flow).
    if (propAgreedPending) {
      setAgreed(true);
      setOtpOpen(true);
    }
  }, [propConsented, propAgreedPending]);

  if (!canConsent) return null;

  const handleOtpInput = (raw) => {
    const extracted = extractOtpFromText(raw, EMAIL_OTP_LENGTH);
    setOtp(extracted ?? String(raw ?? '').replace(/\D/g, '').slice(0, EMAIL_OTP_LENGTH));
    setError(null);
  };

  const sendOtp = async ({ keepOpenOnError = false } = {}) => {
    setError(null);
    setBusy(true);
    try {
      const data = await requestDisplayConsentOtp({
        userId,
        websiteDisplayAgreed: true,
      });
      setMaskedEmail(data?.maskedEmail || '');
      setOtpOpen(true);
      // Do not call onChanged here — parent refresh remounts and hid the OTP panel.
    } catch (err) {
      setError(err?.message || 'Could not send OTP');
      if (!keepOpenOnError) {
        setAgreed(false);
        setOtpOpen(false);
      }
    } finally {
      setBusy(false);
    }
  };

  const clearPendingAgree = async () => {
    setOtpOpen(false);
    setOtp('');
    setMaskedEmail('');
    setAgreed(false);
    setError(null);
    // Clear server-side agreed flag so a later reload does not re-open OTP alone.
    try {
      await revokeDisplayConsent({ userId });
    } catch {
      /* non-fatal — local UI already cleared */
    }
  };

  const onToggleAgree = async (checked) => {
    setError(null);
    if (consented) {
      if (!checked) {
        setBusy(true);
        try {
          await revokeDisplayConsent({ userId });
          setLocalConsented(false);
          setAgreed(false);
          setOtpOpen(false);
          setOtp('');
          onChanged?.();
        } catch (err) {
          setError(err?.message || 'Could not revoke');
          setAgreed(true);
        } finally {
          setBusy(false);
        }
      }
      return;
    }

    if (checked) {
      // Show OTP card immediately (first-image behaviour), then email the code.
      setAgreed(true);
      setOtpOpen(true);
      await sendOtp();
    } else {
      setBusy(true);
      try {
        await clearPendingAgree();
      } finally {
        setBusy(false);
      }
    }
  };

  const verifyOtp = async () => {
    setError(null);
    if (!isValidEmailOtp(otp.trim())) {
      setError('Enter the 4-digit OTP from your email');
      return;
    }
    setBusy(true);
    try {
      await verifyDisplayConsentOtp({ userId, otp: otp.trim() });
      setLocalConsented(true);
      setAgreed(true);
      setOtpOpen(false);
      setOtp('');
      onChanged?.();
    } catch (err) {
      setError(err?.message || 'Verification failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2 px-0.5">
      <label className="flex items-start gap-2.5 text-[13px] leading-snug text-slate-800">
        <input
          type="checkbox"
          checked={agreed || consented}
          disabled={busy}
          onChange={(e) => { void onToggleAgree(e.target.checked); }}
          className="mt-0.5 shrink-0"
        />
        <span>{CONSENT_COPY}</span>
      </label>
      {showOwnerHint ? (
        <p className="pl-6 text-[11px] leading-snug text-slate-500">
          {OWNER_HINT}
        </p>
      ) : null}

      {!consented && otpOpen ? (
        <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
          {maskedEmail ? (
            <p className="text-center text-[12px] text-slate-600">
              Code sent to <strong>{maskedEmail}</strong>
            </p>
          ) : (
            <p className="text-center text-[12px] text-slate-500">
              {busy ? 'Sending code to your email…' : 'Enter the code from your email'}
            </p>
          )}
          <NativeInput
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
            className="w-full rounded-xl border-2 border-emerald-400 bg-white py-2.5 text-center text-xl font-bold tracking-[0.45em] outline-none focus:ring-2 focus:ring-emerald-400"
            autoFocus
          />
          <div className="flex gap-2">
            <TouchFeedbackButton
              onClick={() => { void clearPendingAgree(); }}
              disabled={busy}
              className="flex-1 rounded-xl border border-slate-200 bg-white py-2 text-sm font-semibold text-slate-600"
            >
              Cancel
            </TouchFeedbackButton>
            <TouchFeedbackButton
              onClick={verifyOtp}
              disabled={busy || otp.length !== EMAIL_OTP_LENGTH}
              className="flex-1 rounded-xl bg-emerald-600 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              {busy ? 'Verifying…' : 'Confirm'}
            </TouchFeedbackButton>
          </div>
          <TouchFeedbackButton
            onClick={() => { void sendOtp({ keepOpenOnError: true }); }}
            disabled={busy}
            className="w-full py-1 text-[12px] font-semibold text-emerald-700"
          >
            Resend code
          </TouchFeedbackButton>
        </div>
      ) : null}

      {error ? (
        <p className="text-[12px] text-rose-600">{error}</p>
      ) : null}
    </div>
  );
}
