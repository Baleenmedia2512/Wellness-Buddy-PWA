// Authentication flow controller — OTP send + verify.
// Owns loading/error/success state. Google sign-in stays in caller because it
// is an injected `onSignIn` prop (Firebase). Returns helpers a UI consumes.
import { useState, useEffect } from 'react';
import { sendOtp as sendOtpApi, verifyOtp as verifyOtpApi } from '../services/authService';
import storage from '../../../shared/lib/storage';

/** Storage key for the last-used login email (autofill UX). */
const LAST_EMAIL_KEY = 'auth.lastEmail';

export default function useAuthFlow({ onOtpVerified } = {}) {
  const [email, setEmail] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Autofill: pre-populate with the last-used email on mount.
  useEffect(() => {
    const saved = storage.get(LAST_EMAIL_KEY);
    if (typeof saved === 'string' && saved.length > 0) {
      setEmail(saved);
    }
  }, []);

  const sendOtp = async () => {
    setSuccessMessage('');
    setErrorMessage('');
    setLoading(true);
    try {
      const data = await sendOtpApi(email);
      if (data.success) {
        setOtpSent(true);
        // Persist the email so it autofills on the next login.
        storage.set(LAST_EMAIL_KEY, email);
        return true;
      }
      setErrorMessage(data.message || 'Failed to send OTP.');
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
      const data = await verifyOtpApi(email, otpValue);
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
  };

  return {
    email, setEmail,
    otpSent, setOtpSent,
    verified, loading, errorMessage, successMessage,
    setErrorMessage,
    sendOtp, verifyOtp, resetOtpScreen,
  };
}
