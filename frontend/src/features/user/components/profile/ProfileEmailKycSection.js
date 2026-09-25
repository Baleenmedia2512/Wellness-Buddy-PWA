// ProfileEmailKycSection — verify email on Home Profile (non-blocking KYC).
// Account recovery (adopt existing email) is a separate path when the address is taken.
// Verified email: Community ID–style pencil → edit → tick (OTP) / cancel.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Mail, Pencil, ShieldCheck, X } from 'lucide-react';
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

const iconBtnCls =
  'shrink-0 p-1.5 rounded-md transition-colors disabled:opacity-40 disabled:pointer-events-none';

const fieldShellCls =
  'flex items-center gap-1.5 w-full min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-2';

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
  const [isChanging, setIsChanging] = useState(false);
  const inputRef = useRef(null);
  const baselineEmail = String(verifiedEmail || '').trim().toLowerCase();

  const otpCtl = useOtpInput(EMAIL_OTP_LENGTH);
  const resend = useResendCountdown(60, step === 'otp');

  const typedEmail = String(email || '').trim().toLowerCase();
  const emailValid = looksLikeEmail(typedEmail);
  const differsFromBaseline = Boolean(
    baselineEmail
    && typedEmail
    && typedEmail !== baselineEmail,
  );
  const editingVerified = alreadyVerified && isChanging;
  const canFinishUnchangedEdit = editingVerified && step === 'form' && emailValid && !differsFromBaseline;
  const canSubmitChange = editingVerified && step === 'form' && emailValid && differsFromBaseline && !saving && !disabled;

  useEffect(() => {
    if (mode === 'recover') {
      setIsChanging(false);
      setStep('form');
      setAdoptExisting(true);
      setError('');
      otpCtl.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when switching into recover
  }, [mode]);

  // After a successful verify, parent updates verifiedEmail — exit edit mode.
  useEffect(() => {
    if (!looksLikeEmail(verifiedEmail) || mode === 'recover') return;
    setIsChanging(false);
    setStep('form');
    setEmail('');
    setError('');
    otpCtl.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- settle when saved email changes
  }, [verifiedEmail, mode]);

  useEffect(() => {
    if (editingVerified && step === 'form' && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingVerified, step]);

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

  const handleStartChange = useCallback(() => {
    if (disabled || saving) return;
    setError('');
    setAdoptExisting(false);
    setStep('form');
    setEmail(baselineEmail);
    otpCtl.reset();
    setIsChanging(true);
  }, [disabled, saving, baselineEmail, otpCtl]);

  const handleCancelChange = useCallback(() => {
    if (saving) return;
    setIsChanging(false);
    setStep('form');
    setEmail('');
    setAdoptExisting(false);
    setError('');
    otpCtl.reset();
  }, [saving, otpCtl]);

  const handleTick = useCallback(() => {
    if (canFinishUnchangedEdit) {
      handleCancelChange();
      return;
    }
    if (!canSubmitChange) return;
    handleSendCode();
  }, [canFinishUnchangedEdit, canSubmitChange, handleCancelChange, handleSendCode]);

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
      setIsChanging(false);
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

  if (alreadyVerified && !isChanging) {
    return (
      <div className="rounded-xl border border-green-100 bg-green-50/60 p-3 space-y-2 min-w-0">
        <div className="flex items-center gap-2 text-sm font-semibold text-green-800">
          <ShieldCheck className="w-4 h-4 shrink-0" />
          Email verified
        </div>
        <div className={`${fieldShellCls} cursor-default`}>
          <Mail className="w-4 h-4 text-gray-400 shrink-0" aria-hidden />
          <span
            className="flex-1 min-w-0 truncate text-base text-gray-600"
            style={{ fontSize: '16px' }}
            title={verifiedEmail}
            aria-label="Verified email"
          >
            {verifiedEmail}
          </span>
          <button
            type="button"
            disabled={disabled}
            onClick={handleStartChange}
            className={`${iconBtnCls} text-green-700 hover:bg-green-50`}
            aria-label="Edit email"
            title="Edit"
          >
            <Pencil className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-gray-500">
          Verified emails can appear as a sponsor option for new members.
        </p>
      </div>
    );
  }

  const showInlineEditIcons = editingVerified && step === 'form';
  const tickEnabled = canFinishUnchangedEdit || canSubmitChange;

  return (
    <div
      id="profile-email-kyc"
      className={`rounded-xl border p-3 space-y-3 min-w-0 ${
        isRecover
          ? 'border-blue-100 bg-blue-50/50'
          : editingVerified
            ? 'border-green-100 bg-green-50/60'
            : 'border-amber-100 bg-amber-50/50'
      }`}
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-800">
          {isRecover
            ? 'Recover account'
            : editingVerified
              ? 'Change email'
              : 'Verify email'}
        </p>
        <p className="text-xs text-gray-500 mt-0.5">
          {isRecover
            ? 'Enter the email of your existing account. After OTP, this phone moves onto that account.'
            : editingVerified
              ? 'Enter a new address. We send a 5-minute code to prove it is yours.'
              : 'Verify so new members can find you as a sponsor.'}
        </p>
      </div>

      {step === 'form' && (
        <>
          <div className={`${fieldShellCls} focus-within:ring-2 focus-within:ring-green-500 focus-within:border-green-500`}>
            <Mail className="w-4 h-4 text-gray-400 shrink-0" aria-hidden />
            <input
              ref={inputRef}
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value.trim())}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && showInlineEditIcons && tickEnabled) {
                  e.preventDefault();
                  handleTick();
                }
                if (e.key === 'Escape' && showInlineEditIcons) {
                  e.preventDefault();
                  handleCancelChange();
                }
              }}
              placeholder="you@example.com"
              disabled={disabled || saving}
              className="flex-1 min-w-0 border-0 bg-transparent p-0 outline-none text-base text-gray-800 placeholder:text-gray-400 disabled:opacity-60"
              style={{ fontSize: '16px' }}
              aria-label={editingVerified ? 'New email' : 'Email'}
            />
            {showInlineEditIcons && (
              <>
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleCancelChange}
                  className={`${iconBtnCls} text-gray-500 hover:bg-gray-100`}
                  aria-label="Cancel email change"
                  title="Cancel"
                >
                  <X className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={!tickEnabled}
                  onClick={handleTick}
                  className={`${iconBtnCls} ${
                    tickEnabled
                      ? 'text-green-700 hover:bg-green-50'
                      : 'text-gray-300'
                  }`}
                  aria-label={
                    saving
                      ? 'Sending verification code'
                      : canFinishUnchangedEdit
                        ? 'Done editing email'
                        : 'Send verification code'
                  }
                  title={
                    saving
                      ? 'Sending…'
                      : canFinishUnchangedEdit
                        ? 'Done'
                        : 'Send code'
                  }
                >
                  <Check className="w-4 h-4" strokeWidth={2.5} />
                </button>
              </>
            )}
          </div>
          {showInlineEditIcons && canFinishUnchangedEdit && (
            <p className="text-xs text-gray-500">
              Tap the tick when done, or change the address to verify a new email.
            </p>
          )}
          {!showInlineEditIcons && (
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
          )}
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
          <p className="text-sm font-semibold text-gray-900 truncate min-w-0" title={typedEmail}>{typedEmail}</p>
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
            onClick={() => {
              setStep('form');
              setError('');
              setAdoptExisting(isRecover);
              if (editingVerified) setEmail(baselineEmail);
            }}
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
          <p className="text-sm font-semibold text-gray-900 text-center truncate min-w-0 max-w-full px-1" title={typedEmail}>{typedEmail}</p>
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
            {saving
              ? 'Verifying…'
              : (adoptExisting
                ? 'Recover & verify'
                : editingVerified
                  ? 'Verify & update email'
                  : 'Verify email')}
          </button>
          <button
            type="button"
            onClick={() => {
              setStep('form');
              setError('');
              otpCtl.reset();
              if (editingVerified) setEmail(typedEmail || baselineEmail);
            }}
            disabled={saving}
            className="w-full py-2 rounded-lg text-sm font-semibold border border-gray-300 text-gray-600"
          >
            Change email
          </button>
          {editingVerified && (
            <button
              type="button"
              onClick={handleCancelChange}
              disabled={saving}
              className="w-full py-2 rounded-lg text-sm font-semibold border border-gray-300 text-gray-600"
            >
              Keep current email
            </button>
          )}
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
