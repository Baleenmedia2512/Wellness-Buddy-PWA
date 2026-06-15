// Authentication flow controller — OTP send + verify.
// Supports TWO recipient channels through a single state machine:
//   - email   → backend OTP via /api/auth/send-otp + verify-otp (SMTP)
//   - phone   → backend OTP via /api/auth/send-otp + verify-otp (MDT SMS)
//
// Owns loading/error/success state. Google sign-in stays in caller because it
// is an injected `onSignIn` prop (Firebase). Returns helpers a UI consumes.
import { useRef, useState } from 'react';
import { sendOtp as sendOtpApi, verifyOtp as verifyOtpApi } from '../services/authService';
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

  // E.164 phone frozen for the verify step (phone channel only).
  const phoneRecipientRef = useRef(null);

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
        const data = await sendOtpApi(email, 'email');
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
        const data = await sendOtpApi(e164, 'phone');
        if (data.success) {
          phoneRecipientRef.current = e164;
          setActiveChannel('phone');
          setOtpSent(true);
          return true;
        }
        setErrorMessage(data.message || 'Failed to send OTP.');
        return false;
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
        const phoneRecipient = phoneRecipientRef.current;
        if (!phoneRecipient) {
          setErrorMessage('Session expired. Please resend the OTP.');
          return false;
        }
        data = await verifyOtpApi(phoneRecipient, otpValue, undefined, 'phone');
      } else {
        data = await verifyOtpApi(email, otpValue, undefined, 'email');
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
    sendOtp, verifyOtp, resetOtpScreen,
  };
}
