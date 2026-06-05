// Authentication flow controller — OTP send + verify.
// Supports TWO recipient channels through a single state machine:
//   - email   → backend OTP (existing) via /api/auth/send-otp + verify-otp
//   - phone   → Firebase Phone Auth (signInWithPhoneNumber → confirm),
//               then exchange the Firebase ID token for our session via
//               /api/auth/firebase-phone-login.
//
// Owns loading/error/success state. Google sign-in stays in caller because it
// is an injected `onSignIn` prop (Firebase). Returns helpers a UI consumes.
import { useRef, useState } from 'react';
import { sendOtp as sendOtpApi, verifyOtp as verifyOtpApi } from '../services/authService';
import {
  sendPhoneOtp,
  confirmPhoneOtp,
  exchangeFirebaseIdToken,
  resetPhoneAuth,
} from '../services/phoneAuthService';
import {
  detectContactType,
  normalizePhone,
  isValidEmail,
  isValidPhoneE164,
  DEFAULT_COUNTRY,
} from '../domain/contactIdentifier';

export default function useAuthFlow({ onOtpVerified } = {}) {
  // `email` keeps its name for backward-compat with existing tests/UI; it now
  // holds either an email OR a raw phone number (the user-typed value).
  const [email, setEmail] = useState('');
  const [countryDial, setCountryDial] = useState(DEFAULT_COUNTRY.dial);
  const [otpSent, setOtpSent] = useState(false);
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  // `contactType` is derived at send time and frozen for the verify step so
  // a half-typed change to the input doesn't switch flows mid-verification.
  const [activeChannel, setActiveChannel] = useState(null); // 'email' | 'phone' | null

  // Firebase confirmationResult for the in-progress phone flow. A ref (not
  // state) because it carries non-serializable closures.
  const phoneConfirmationRef = useRef(null);

  const sendOtp = async () => {
    setSuccessMessage('');
    setErrorMessage('');
    setLoading(true);
    try {
      const channel = detectContactType(email);
      if (channel === 'email') {
        if (!isValidEmail(email)) {
          setErrorMessage('Please enter a valid email address.');
          return false;
        }
        const data = await sendOtpApi(email);
        if (data.success) {
          setActiveChannel('email');
          setOtpSent(true);
          return true;
        }
        setErrorMessage(data.message || 'Failed to send OTP.');
        return false;
      }
      if (channel === 'phone') {
        const e164 = normalizePhone(email, countryDial);
        if (!isValidPhoneE164(e164)) {
          setErrorMessage('Please enter a valid phone number.');
          return false;
        }
        try {
          phoneConfirmationRef.current = await sendPhoneOtp(e164);
          setActiveChannel('phone');
          setOtpSent(true);
          return true;
        } catch (err) {
          resetPhoneAuth();
          setErrorMessage(mapFirebaseError(err) || 'Failed to send OTP.');
          return false;
        }
      }
      setErrorMessage('Enter an email address or phone number.');
      return false;
    } catch {
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
        if (!phoneConfirmationRef.current) {
          setErrorMessage('Session expired. Please resend the OTP.');
          return false;
        }
        try {
          const { idToken } = await confirmPhoneOtp(phoneConfirmationRef.current, otpValue);
          data = await exchangeFirebaseIdToken(idToken);
        } catch (err) {
          setErrorMessage(mapFirebaseError(err) || 'Invalid OTP.');
          return false;
        }
      } else {
        data = await verifyOtpApi(email, otpValue);
      }
      if (!data.success) {
        setErrorMessage(data.message || 'Invalid OTP.');
        return false;
      }
      setVerified(true);
      setSuccessMessage('OTP verified successfully!');
      const userDataWithNewFlag = { ...data.user, isNewUser: data.isNewUser === true };
      localStorage.setItem('otpUser', JSON.stringify(userDataWithNewFlag));
      setTimeout(async () => {
        setSuccessMessage('');
        if (onOtpVerified) await onOtpVerified(data.isNewUser === true);
        setTimeout(() => setVerified(false), 2000);
      }, 1500);
      return true;
    } catch {
      setErrorMessage('Failed to verify OTP. Please try again.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const resetOtpScreen = () => {
    setOtpSent(false);
    setErrorMessage('');
    if (activeChannel === 'phone') {
      resetPhoneAuth();
      phoneConfirmationRef.current = null;
    }
    setActiveChannel(null);
  };

  return {
    email, setEmail,
    countryDial, setCountryDial,
    otpSent, setOtpSent,
    verified, loading, errorMessage, successMessage,
    setErrorMessage,
    activeChannel,
    sendOtp, verifyOtp, resetOtpScreen,
  };
}

// Map Firebase auth error codes → human-friendly messages. Defined at module
// scope so it stays pure and unit-testable from the same file later.
function mapFirebaseError(err) {
  const code = err && err.code;
  switch (code) {
    case 'auth/invalid-phone-number':       return 'Please enter a valid phone number.';
    case 'auth/missing-phone-number':       return 'Please enter your phone number.';
    case 'auth/quota-exceeded':             return 'SMS quota exceeded. Try again later.';
    case 'auth/too-many-requests':          return 'Too many attempts. Please wait a few minutes.';
    case 'auth/invalid-verification-code':  return 'Invalid OTP. Please try again.';
    case 'auth/code-expired':               return 'OTP expired. Please request a new one.';
    case 'auth/captcha-check-failed':       return 'Security check failed. Please try again.';
    default:                                return '';
  }
}
