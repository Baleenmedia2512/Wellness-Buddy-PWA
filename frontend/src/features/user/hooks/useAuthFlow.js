// Authentication flow controller — OTP send + verify.
// Phone-only channel: MDT SMS OTP via /api/auth/send-otp + verify-otp.
// SMS suggestion: first OTP cell uses autoComplete="one-time-code" (iOS + Android).
// WebOTP API also auto-reads when the SMS includes @domain #code.
// Pending OTP step is persisted (sessionStorage) so mobile-web tab reload
// after switching to the SMS app still shows Enter OTP.
// Phone draft survives Login remount when web authLoading flips false.
import { useEffect, useRef, useState } from 'react';
import { sendOtp as sendOtpApi, verifyOtp as verifyOtpApi } from '../services/authService';
import {
  normalizePhone,
  isValidPhoneE164,
  DEFAULT_COUNTRY,
} from '../domain/contactIdentifier';
import { debugLog } from '../../../shared/utils/logger.js';
import storage from '../../../shared/lib/storage.js';
import { persistLocalConsentAcceptance } from '../domain/consent.js';
import { recordConsentAcceptance } from '../services/consent.api.js';
import {
  clearLoginOtpChallenge,
  loadLoginOtpChallenge,
  saveLoginOtpChallenge,
} from '../domain/loginOtpChallenge.js';
import {
  clearLoginPhoneDraft,
  loadLoginPhoneDraft,
  saveLoginPhoneDraft,
} from '../domain/loginPhoneDraft.js';

export default function useAuthFlow({ onOtpVerified } = {}) {
  // Restore once on mount — OTP challenge first, else in-progress phone draft
  // (App remounts <Login> when Firebase authLoading ends on web).
  const [restoredChallenge] = useState(() => loadLoginOtpChallenge());
  const [restoredDraft] = useState(() => {
    if (loadLoginOtpChallenge()) return null;
    return loadLoginPhoneDraft();
  });
  const restored = restoredChallenge || restoredDraft;
  // `email` keeps its name for backward-compat with existing tests/UI; it now
  // holds either an email OR a raw phone number (the user-typed value).
  const [email, setEmail] = useState(() => restored?.email || '');
  const [countryDial, setCountryDial] = useState(() => restored?.countryDial || DEFAULT_COUNTRY.dial);
  const [otpSent, setOtpSent] = useState(() => Boolean(restoredChallenge));
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  // `contactType` is derived at send time and frozen for the verify step so
  // a half-typed change to the input doesn't switch flows mid-verification.
  const [activeChannel, setActiveChannel] = useState(() => restoredChallenge?.activeChannel || null); // 'email' | 'phone' | null
  const [termsAccepted, setTermsAccepted] = useState(() => restored?.termsAccepted === true);

  // E.164 phone frozen for the verify step (phone channel only).
  const phoneRecipientRef = useRef(restoredChallenge?.phoneRecipient || null);

  // Keep draft warm while typing so authLoading → Login remount does not wipe digits.
  useEffect(() => {
    if (otpSent) return undefined;
    saveLoginPhoneDraft({
      email,
      countryDial,
      termsAccepted: termsAccepted === true,
    });
    return undefined;
  }, [email, countryDial, termsAccepted, otpSent]);

  const sendOtp = async () => {
    setSuccessMessage('');
    setErrorMessage('');
    setLoading(true);
    try {
      const e164 = normalizePhone(email, countryDial);
      if (!isValidPhoneE164(e164)) {
        setErrorMessage('Please enter a valid phone number.');
        return false;
      }
      const data = await sendOtpApi(e164, 'phone');
      const phoneLog = {
        httpStatus: data?._httpStatus,
        success: data?.success,
        hasOtpInResponse: Object.prototype.hasOwnProperty.call(data || {}, 'otp'),
        message: data?.message || '',
        providerError: data?.providerError || '',
        missingConfig: data?.missingConfig || [],
      };
      debugLog('[OTP/SMS] phone sendOtp result', phoneLog);
      if (!data?.success || phoneLog.hasOtpInResponse) {
        // eslint-disable-next-line no-console -- intentional debug for SMS troubleshooting
        console.warn('[OTP/SMS] phone OTP not sent via SMS', phoneLog);
      }
      if (data.success) {
        phoneRecipientRef.current = e164;
        setActiveChannel('phone');
        setOtpSent(true);
        clearLoginPhoneDraft();
        saveLoginOtpChallenge({
          email,
          countryDial,
          phoneRecipient: e164,
          termsAccepted: termsAccepted === true,
          sentAt: Date.now(),
        });
        return true;
      }
      const missing = Array.isArray(data?.missingConfig) ? data.missingConfig.filter(Boolean) : [];
      setErrorMessage(
        missing.length > 0
          ? `${data.message || 'SMS not configured.'} Missing: ${missing.join(', ')}.`
          : (data.message || 'Failed to send OTP.'),
      );
      return false;
    } catch (err) {
      console.warn('[OTP/SMS] sendOtp fetch failed', err);
      setErrorMessage('Failed to send OTP. Please try again.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (otpValue) => {
    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');
    setVerified(false);
    try {
      let data;
      if (activeChannel === 'phone') {
        const phoneRecipient = phoneRecipientRef.current;
        if (!phoneRecipient) {
          setErrorMessage('Session expired. Please resend the OTP.');
          return false;
        }
        data = await verifyOtpApi(phoneRecipient, otpValue, undefined, 'phone', {
          consentAccepted: termsAccepted === true,
        });
      } else {
        setErrorMessage('Session expired. Please resend the OTP.');
        return false;
      }
      if (!data.success) {
        setErrorMessage(data.message || 'Invalid OTP.');
        return false;
      }
      const acceptedUserId = data.user?.id || data.user?.UserId;
      const needsConsentWrite = termsAccepted === true
        && data.user?.consentRequired !== false
        && Boolean(acceptedUserId);
      if (termsAccepted === true) {
        persistLocalConsentAcceptance();
        if (data.user) data.user = { ...data.user, consentRequired: false };
      }
      const userDataWithNewFlag = { ...data.user, isNewUser: data.isNewUser === true };
      storage.set('otpUser', JSON.stringify(userDataWithNewFlag));
      if (needsConsentWrite) {
        recordConsentAcceptance({
          userId: acceptedUserId,
          email: data.user?.email || undefined,
        }).catch((err) => {
          console.warn('[verify-otp] consent save failed after signup acceptance', err?.message);
        });
      }
      // Leave the OTP screen as soon as the code is accepted.
      clearLoginOtpChallenge();
      clearLoginPhoneDraft();
      if (onOtpVerified) await onOtpVerified(data.isNewUser === true);
      return true;
    } catch {
      setErrorMessage('Failed to verify OTP. Please try again.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const resetOtpScreen = () => {
    clearLoginOtpChallenge();
    setOtpSent(false);
    setErrorMessage('');
    phoneRecipientRef.current = null;
    setActiveChannel(null);
  };

  return {
    email, setEmail,
    countryDial, setCountryDial,
    otpSent, setOtpSent,
    verified, loading, errorMessage, successMessage,
    setErrorMessage,
    activeChannel,
    termsAccepted, setTermsAccepted,
    sendOtp, verifyOtp, resetOtpScreen,
  };
}
