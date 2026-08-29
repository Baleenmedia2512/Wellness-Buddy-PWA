// OnboardingIdentityPage — name + email, then 5-minute email OTP.
// Existing emails can recover the old account after OTP (new phone → that email).
import React, { useEffect, useState, useCallback } from 'react';
import { User, Mail } from 'lucide-react';
import { fetchProfile, saveProfile, saveEmailIdentity } from '../services/profileService';
import { sendOtp } from '../services/authService';
import {
  checkOnboardingEmail,
  verifyOnboardingEmail,
} from '../services/onboardingEmail.api.js';
import { hasValidProfileName } from '../domain/profileCompleteness';
import {
  looksLikeEmail,
  formatOtpCountdown,
  ONBOARDING_EMAIL_OTP_SECONDS,
  EMAIL_TAKEN_ADOPT_MESSAGE,
} from '../domain/onboardingEmail.js';
import useOtpInput from '../hooks/useOtpInput';
import { EMAIL_OTP_LENGTH } from '../domain/otpLength';
import useResendCountdown from '../hooks/useResendCountdown';
import NativeInput, {
  otpAutoCompleteForCell,
  otpMaxLengthForCell,
} from '../../../shared/components/NativeInput.jsx';

const inputCls = (invalid) =>
  `w-full pl-10 pr-4 py-3 border-2 rounded-xl focus:outline-none text-base bg-white ${
    invalid ? 'border-red-300 focus:border-red-400' : 'border-gray-200 focus:border-green-400'
  }`;

function sessionDisplayName(user) {
  return String(
    user?.userName
    || user?.UserName
    || user?.username
    || user?.name
    || '',
  ).trim();
}

function sessionPhone(user) {
  return user?.phoneNumber || user?.PhoneNumber || user?.phone || null;
}

/**
 * @param {{
 *   user: object,
 *   onComplete: (saved: {
 *     email?: string,
 *     userName: string,
 *     adopted?: boolean,
 *     userId?: number,
 *     phone?: string,
 *   }) => void | Promise<void>,
 * }} props
 */
const OnboardingIdentityPage = ({ user, onComplete }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState('form'); // form | adopt | otp
  const [adoptExisting, setAdoptExisting] = useState(false);
  const [otpExpiresIn, setOtpExpiresIn] = useState(ONBOARDING_EMAIL_OTP_SECONDS);

  const otpCtl = useOtpInput(EMAIL_OTP_LENGTH);
  const resend = useResendCountdown(60, step === 'otp');

  const loginEmail = (user?.email || user?.Email || '').trim();
  const phone = sessionPhone(user);
  const uid = user?.id || user?.UserId || user?.userId;
  const emailLocked = looksLikeEmail(loginEmail);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const applySessionName = (emailForCheck) => {
        const fromSession = sessionDisplayName(user);
        if (hasValidProfileName(fromSession, { email: emailForCheck, phoneNumber: phone })) {
          setName(fromSession);
        }
      };

      try {
        if (!loginEmail) {
          if (uid) {
            try {
              const result = await fetchProfile({ userId: uid });
              if (!mounted) return;
              const profile = result?.data;
              const profileEmail = String(profile?.email || '').trim();
              if (looksLikeEmail(profileEmail)) setEmail(profileEmail);
              if (hasValidProfileName(profile?.userName, {
                phoneNumber: profile?.phoneNumber || phone,
              })) {
                setName(String(profile.userName).trim());
              } else {
                applySessionName('');
              }
            } catch {
              if (mounted) applySessionName('');
            }
            if (mounted) setLoading(false);
            return;
          }
          if (mounted) {
            applySessionName('');
            setLoading(false);
          }
          return;
        }
        const result = await fetchProfile(loginEmail);
        if (!mounted) return;
        const profile = result?.data;
        const profileEmail = (profile?.email || loginEmail).trim();
        if (looksLikeEmail(profileEmail)) setEmail(profileEmail);
        if (hasValidProfileName(profile?.userName, {
          email: profileEmail,
          phoneNumber: profile?.phoneNumber || phone,
        })) {
          setName(String(profile.userName).trim());
        } else {
          applySessionName(profileEmail);
        }
      } catch {
        if (mounted) applySessionName(loginEmail);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [loginEmail, user, phone, uid]);

  useEffect(() => {
    if (step !== 'otp') return undefined;
    if (otpExpiresIn <= 0) return undefined;
    const t = setTimeout(() => setOtpExpiresIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [step, otpExpiresIn]);

  const nameValid = hasValidProfileName(name, { phoneNumber: phone });
  const typedEmail = String(email || loginEmail || '').trim().toLowerCase();
  const emailValid = looksLikeEmail(typedEmail);
  const canContinueForm = nameValid && (emailLocked || emailValid) && !saving;

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

  const handleContinue = useCallback(async () => {
    setError('');
    if (!nameValid) {
      setError('Please enter your full name (not a temporary login username).');
      return;
    }
    const trimmedName = String(name).trim();

    if (emailLocked) {
      setSaving(true);
      try {
        await saveProfile({ email: loginEmail, name: trimmedName });
        await onComplete?.({ email: loginEmail, userName: trimmedName });
      } catch (e) {
        setError(e?.message || 'Could not save. Please try again.');
      } finally {
        setSaving(false);
      }
      return;
    }

    if (!emailValid) {
      setError('Enter a valid email. We will send a 5-minute code to prove it is yours.');
      return;
    }
    if (!uid) {
      setError('Unable to identify your account. Please re-login.');
      return;
    }

    setSaving(true);
    try {
      await saveEmailIdentity({ userId: uid, name: trimmedName });
      const check = await checkOnboardingEmail({
        userId: uid,
        email: typedEmail,
        sendOtp: true,
      });
      if (!check.ok || (!check.data?.success && check.status >= 400)) {
        setError(check.data?.message || 'Could not send the verification email. Try again.');
        return;
      }
      if (check.data?.available === false) {
        setAdoptExisting(true);
        setStep('adopt');
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
  }, [
    name, nameValid, emailLocked, emailValid, loginEmail, uid, typedEmail,
    onComplete, startOtpStep, otpCtl, resend,
  ]);

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
        userId: uid,
        email: typedEmail,
        otp: otpCtl.value,
        name: String(name).trim(),
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
      await onComplete?.({
        email: data.email || typedEmail,
        userName: data.userName || String(name).trim(),
        adopted: data.adopted === true,
        userId: data.user?.id,
        phone: data.user?.phone,
      });
    } catch (e) {
      setError(e?.message || 'Could not verify. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [otpCtl, otpExpiresIn, uid, typedEmail, name, adoptExisting, onComplete]);

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

  if (loading) {
    return (
      <div className="fixed inset-0 z-[80] bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-green-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[80] bg-gray-50 flex flex-col">
      <div className="bg-gradient-to-r from-green-600 to-green-700 px-4 pt-10 pb-6 text-white">
        <h1 className="text-xl font-bold">Welcome</h1>
        <p className="text-sm text-green-100 mt-1">
          {step === 'otp'
            ? 'Verify your email'
            : step === 'adopt'
              ? 'This email already has an account'
              : 'What should we call you?'}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="bg-white rounded-2xl shadow-sm p-5 space-y-5 max-w-md mx-auto">
          {step === 'form' && (
            <>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your full name"
                    className={inputCls(name && !nameValid)}
                    style={{ fontSize: '16px' }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Email <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                  <input
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    value={emailLocked ? loginEmail : email}
                    onChange={(e) => setEmail(e.target.value.trim())}
                    placeholder="you@example.com"
                    disabled={emailLocked}
                    className={`${inputCls(email && !emailValid)} ${emailLocked ? 'bg-gray-50 text-gray-600' : ''}`}
                    style={{ fontSize: '16px' }}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {emailLocked
                    ? 'From your login account'
                    : 'We send a 5-minute code so only you can use this email.'}
                </p>
              </div>
            </>
          )}

          {step === 'adopt' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-700">
                {EMAIL_TAKEN_ADOPT_MESSAGE}
              </p>
              <p className="text-sm text-gray-500">
                If this is your old account (you changed numbers), we will
                email a 5-minute code. After you verify it, this new number
                replaces the old one on that account.
              </p>
              <p className="text-sm font-semibold text-gray-900 truncate">{typedEmail}</p>
            </div>
          )}

          {step === 'otp' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-700 text-center">
                We sent a 4-digit code to
              </p>
              <p className="text-sm font-semibold text-gray-900 text-center truncate">{typedEmail}</p>
              <p className="text-xs text-gray-500 text-center">
                The code expires in 5 minutes. Check your inbox.
              </p>
              <div className="flex justify-center gap-2" onPaste={(e) => {
                const filled = otpCtl.handlePaste(e);
                if (filled) setError('');
              }}>
                {otpCtl.otp.map((digit, i) => (
                  <NativeInput
                    key={i}
                    otp
                    ref={(el) => { otpCtl.refs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete={otpAutoCompleteForCell(i, EMAIL_OTP_LENGTH, { emailOtp: true })}
                    maxLength={otpMaxLengthForCell(i, EMAIL_OTP_LENGTH, { emailOtp: true })}
                    value={digit}
                    onChange={(e) => otpCtl.handleChange(i, e.target.value)}
                    onKeyDown={(e) => otpCtl.handleKeyDown(i, e)}
                    className="w-11 h-12 text-center text-lg font-bold border-2 rounded-xl focus:outline-none focus:border-green-500 transition-colors text-[16px]"
                    style={{ borderColor: digit ? '#16a34a' : '#e5e7eb' }}
                  />
                ))}
              </div>
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
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}

          {step === 'form' && (
            <button
              type="button"
              onClick={handleContinue}
              disabled={!canContinueForm}
              className="w-full py-3.5 bg-green-500 text-white rounded-xl font-semibold text-base disabled:opacity-50 shadow-md"
            >
              {saving ? (emailLocked ? 'Saving…' : 'Checking…') : (emailLocked ? 'Continue' : 'Send verification code')}
            </button>
          )}

          {step === 'adopt' && (
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleAdoptYes}
                disabled={saving}
                className="w-full py-3.5 bg-green-500 text-white rounded-xl font-semibold text-base disabled:opacity-50 shadow-md"
              >
                {saving ? 'Sending…' : 'Yes, use this account'}
              </button>
              <button
                type="button"
                onClick={() => { setStep('form'); setError(''); setAdoptExisting(false); }}
                disabled={saving}
                className="w-full py-3 rounded-xl font-semibold text-sm border-2 border-gray-300 text-gray-600"
              >
                Use a different email
              </button>
            </div>
          )}

          {step === 'otp' && (
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleVerifyOtp}
                disabled={!otpCtl.isComplete || saving || otpExpiresIn <= 0}
                className="w-full py-3.5 bg-green-500 text-white rounded-xl font-semibold text-base disabled:opacity-50 shadow-md"
              >
                {saving ? 'Verifying…' : 'Verify email'}
              </button>
              <button
                type="button"
                onClick={() => { setStep('form'); setError(''); otpCtl.reset(); }}
                disabled={saving}
                className="w-full py-3 rounded-xl font-semibold text-sm border-2 border-gray-300 text-gray-600"
              >
                Change email
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OnboardingIdentityPage;
