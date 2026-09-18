// ProfileEmailKycSection — verify email on Home Profile (non-blocking KYC).
// Account recovery (adopt existing email) is a separate path when the address is taken.
import React, { useCallback, useEffect, useState } from 'react';
import { Mail, ShieldCheck } from 'lucide-react';
import { sendOtp } from '../../services/authService';
import {
  checkOnboardingEmail,
  verifyOnboardingEmail,
} from '../../services/onboardingEmail.api.js';
import {
  looksLikeEmail,
  formatOtpCountdown,
  ONBOARDING_EMAIL_OTP_SECONDS,
  EMAIL_TAKEN_ADOPT_MESSAGE,
} from '../../domain/onboardingEmail.js';
import useOtpInput from '../../hooks/useOtpInput';
import { EMAIL_OTP_LENGTH } from '../../domain/otpLength';
import useResendCountdown from '../../hooks/useResendCountdown';
import OtpInputCells from '../../../../shared/components/OtpInputCells.jsx';

const inputCls =
  'w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-base';

/**
 * @param {{
 *   userId: number|string|null,
 *   userName?: string,
 *   verifiedEmail?: string,
 *   disabled?: boolean,
 *   mode?: 'verify' | 'recover',
 *   onModeChange?: (mode: 'verify' | 'recover') => void,
 *   onVerified?: (result: {
 *     email: string,
 *     userName?: string,
 *     adopted?: boolean,
 *     userId?: number,
 *     phone?: string,
 *   }) => void | Promise<void>,
 * }} props
 */
const ProfileEmailKycSection = ({
  userId,
  userName = '',
  verifiedEmail = '',
  disabled = false,
  mode = 'verify',
  onModeChange,
  onVerified,
}) => {
  const alreadyVerified = looksLikeEmail(verifiedEmail) && mode !== 'recover';
  const isRecover = mode === 'recover';
  const [email, setEmail] = useState('');
  const [step, setStep] = useState('form'); // form | adopt | otp
  const [adoptExisting, setAdoptExisting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [otpExpiresIn, setOtpExpiresIn] = useState(ONBOARDING_EMAIL_OTP_SECONDS);

  const otpCtl = useOtpInput(EMAIL_OTP_LENGTH);
  const resend = useResendCountdown(60, step === 'otp');

  const typedEmail = String(email || '').trim().toLowerCase();
  const emailValid = looksLikeEmail(typedEmail);

  useEffect(() => {
    if (mode === 'recover') {
      setStep('form');
      setAdoptExisting(true);
      setError('');
      otpCtl.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when switching into recover
  }, [mode]);

  useEffect(() => {
    if (step !== 'otp') return undefined;
    if (otpExpiresIn <= 0) return undefined;
    const t = setTimeout(() => setOtpExpiresIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [step, otpExpiresIn]);

  const dispatchOtp = useCallback(async (toEmail) => {
    const data = await sendOtp(toEmail, 'email');
    if (!data?.success) {
      throw new Error(data?.message || 'Could not send the verification email. Try again.');
    }
  }, []);

  const startOtpStep = useCallback(async (toEmail, recoverAccount) => {
    await dispatchOtp(toEmail);
    setAdoptExisting(recoverAccount);
    otpCtl.reset();
    setOtpExpiresIn(ONBOARDING_EMAIL_OTP_SECONDS);
    resend.start(60);
    setStep('otp');
  }, [dispatchOtp, otpCtl, resend]);

  const handleSendCode = useCallback(async () => {
    setError('');
    if (!emailValid) {
      setError(isRecover
        ? 'Enter the email of the account you want to recover.'
        : 'Enter a valid email. We will send a 5-minute code to prove it is yours.');
      return;
    }
    if (!userId) {
      setError('Unable to identify your account. Please re-login.');
      return;
    }
    setSaving(true);
    try {
      const check = await checkOnboardingEmail({
        userId,
        email: typedEmail,
        sendOtp: !isRecover,
      });
      if (!check.ok || (!check.data?.success && check.status >= 400)) {
        setError(check.data?.message || 'Could not check that email. Try again.');
        return;
      }
      if (check.data?.available === false) {
        setAdoptExisting(true);
        setStep('adopt');
        return;
      }
      if (isRecover) {
        setError('No existing account uses that email. Check the address, or verify it as a new email instead.');
        return;
      }
      if (check.data?.otpSent === true) {
        setAdoptExisting(false);
        otpCtl.reset();
        setOtpExpiresIn(ONBOARDING_EMAIL_OTP_SECONDS);
        resend.start(60);
        setStep('otp');
        return;
      }
      await startOtpStep(typedEmail, false);
    } catch (e) {
      setError(e?.message || 'Could not continue. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [emailValid, userId, typedEmail, isRecover, startOtpStep, otpCtl, resend]);

  const handleAdoptYes = useCallback(async () => {
    setError('');
    setSaving(true);
    try {
      await startOtpStep(typedEmail, true);
    } catch (e) {
      setError(e?.message || 'Could not send the verification email. Try again.');
    } finally {
      setSaving(false);
    }
  }, [startOtpStep, typedEmail]);

  const handleVerifyOtp = useCallback(async () => {
    setError('');
    if (!otpCtl.isComplete) return;
    if (otpExpiresIn <= 0) {
      setError('That code expired. Resend a new one.');
      return;
    }
    setSaving(true);
    try {
      const result = await verifyOnboardingEmail({
        userId,
        email: typedEmail,
        otp: otpCtl.value,
        name: String(userName || '').trim() || undefined,
        adoptExisting,
      });
      const data = result.data || {};
      if (data.code === 'EMAIL_TAKEN' || result.status === 409) {
        setStep('adopt');
        setError(data.message || EMAIL_TAKEN_ADOPT_MESSAGE);
        return;
      }
      if (!result.ok || !data.success) {
        setError(data.message || 'Invalid or expired code. Try again.');
        return;
      }
      await onVerified?.({
        email: data.email || typedEmail,
        userName: data.userName,
        adopted: data.adopted === true,
        userId: data.user?.id,
        phone: data.user?.phone,
      });
      setStep('form');
      setEmail('');
      otpCtl.reset();
      onModeChange?.('verify');
    } catch (e) {
      setError(e?.message || 'Could not verify. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [otpCtl, otpExpiresIn, userId, typedEmail, userName, adoptExisting, onVerified, onModeChange]);

  const handleResend = useCallback(async () => {
    setError('');
    setSaving(true);
    try {
      await dispatchOtp(typedEmail);
      otpCtl.reset();
      setOtpExpiresIn(ONBOARDING_EMAIL_OTP_SECONDS);
      resend.start(60);
    } catch (e) {
      setError(e?.message || 'Could not resend. Try again.');
    } finally {
      setSaving(false);
    }
  }, [dispatchOtp, typedEmail, otpCtl, resend]);

  if (alreadyVerified) {
    return (
      <div className="rounded-xl border border-green-100 bg-green-50/60 p-3 space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-green-800">
          <ShieldCheck className="w-4 h-4" />
          Email verified
        </div>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="email"
            value={verifiedEmail}
            readOnly
            className={`${inputCls} bg-white text-gray-600 cursor-not-allowed`}
            style={{ fontSize: '16px' }}
          />
        </div>
        <p className="text-xs text-gray-500">
          Verified emails can appear as a sponsor option for new members.
        </p>
      </div>
    );
  }

  return (
    <div
      id="profile-email-kyc"
      className={`rounded-xl border p-3 space-y-3 ${
        isRecover
          ? 'border-blue-100 bg-blue-50/50'
          : 'border-amber-100 bg-amber-50/50'
      }`}
    >
      <div>
        <p className="text-sm font-semibold text-gray-800">
          {isRecover ? 'Recover account' : 'Verify email (optional)'}
        </p>
        <p className="text-xs text-gray-500 mt-0.5">
          {isRecover
            ? 'Enter the email of your existing account. After OTP, this phone moves onto that account.'
            : 'Not required to use the app. Verify so new members can find you as a sponsor.'}
        </p>
      </div>

      {step === 'form' && (
        <>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value.trim())}
              placeholder="you@example.com"
              disabled={disabled || saving}
              className={inputCls}
              style={{ fontSize: '16px' }}
            />
          </div>
          <button
            type="button"
            onClick={handleSendCode}
            disabled={disabled || saving || !emailValid}
            className="w-full py-2.5 bg-green-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
          >
            {saving
              ? 'Checking…'
              : (isRecover ? 'Find account' : 'Send verification code')}
          </button>
          {isRecover && (
            <button
              type="button"
              onClick={() => onModeChange?.('verify')}
              disabled={saving}
              className="w-full py-2 rounded-lg text-sm font-semibold border border-gray-300 text-gray-600"
            >
              Back to email verification
            </button>
          )}
        </>
      )}

      {step === 'adopt' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-700">{EMAIL_TAKEN_ADOPT_MESSAGE}</p>
          <p className="text-sm text-gray-500">
            We email a 5-minute code. After you verify, this phone replaces the
            old number on that account.
          </p>
          <p className="text-sm font-semibold text-gray-900 truncate">{typedEmail}</p>
          <button
            type="button"
            onClick={handleAdoptYes}
            disabled={disabled || saving}
            className="w-full py-2.5 bg-green-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
          >
            {saving ? 'Sending…' : 'Recover this account'}
          </button>
          <button
            type="button"
            onClick={() => { setStep('form'); setError(''); setAdoptExisting(isRecover); }}
            disabled={saving}
            className="w-full py-2 rounded-lg text-sm font-semibold border border-gray-300 text-gray-600"
          >
            Use a different email
          </button>
        </div>
      )}

      {step === 'otp' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-700 text-center">
            We sent a 4-digit code to
          </p>
          <p className="text-sm font-semibold text-gray-900 text-center truncate">{typedEmail}</p>
          <OtpInputCells
            otpCtl={otpCtl}
            length={EMAIL_OTP_LENGTH}
            emailOtp
            className="flex justify-center gap-2"
            cellClassName="w-11 h-12 text-center text-lg font-bold border-2 rounded-xl focus:outline-none focus:border-green-500 transition-colors text-[16px]"
            cellStyle={(digit) => ({ borderColor: digit ? '#16a34a' : '#e5e7eb' })}
          />
          <p className={`text-center text-xs ${otpExpiresIn <= 0 ? 'text-red-500' : 'text-gray-500'}`}>
            {otpExpiresIn <= 0
              ? 'Code expired. Resend a new one.'
              : `Code expires in ${formatOtpCountdown(otpExpiresIn)}`}
          </p>
          <div className="text-center">
            {resend.canResend ? (
              <button
                type="button"
                onClick={handleResend}
                disabled={saving}
                className="text-xs text-green-700 font-semibold underline disabled:opacity-50"
              >
                {saving ? 'Sending…' : 'Resend code'}
              </button>
            ) : (
              <p className="text-xs text-gray-400">
                Resend in <span className="font-semibold text-gray-600">{resend.countdown}s</span>
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleVerifyOtp}
            disabled={!otpCtl.isComplete || saving || otpExpiresIn <= 0}
            className="w-full py-2.5 bg-green-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
          >
            {saving ? 'Verifying…' : (adoptExisting ? 'Recover & verify' : 'Verify email')}
          </button>
          <button
            type="button"
            onClick={() => { setStep('form'); setError(''); otpCtl.reset(); }}
            disabled={saving}
            className="w-full py-2 rounded-lg text-sm font-semibold border border-gray-300 text-gray-600"
          >
            Change email
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-xs">
          {error}
        </div>
      )}
    </div>
  );
};

export default ProfileEmailKycSection;
