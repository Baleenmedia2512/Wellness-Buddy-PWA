// WebOTP & Native SMS Retriever API hook — auto-reads OTP from incoming SMS.
//
// Platform behaviour:
//   Android Native (Capacitor): Uses @capawesome/capacitor-android-sms-retriever
//     (Google Play Services SMS User Consent API). Works with any SMS format
//     (including DLT-approved Baleen Media messages) without dangerous permissions.
//
//   Android Chrome / Web: Uses `navigator.credentials.get({ otp })` (WebOTP API).
//
//   iOS Safari: autoComplete="one-time-code" on the input handles autofill at
//     the OS level.
import { useCallback, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { AndroidSmsRetriever } from '@capawesome/capacitor-android-sms-retriever';

/**
 * @param {(code: string) => void} onOtpReceived
 *   Called with the raw OTP string (digits only) when auto-read from an incoming SMS.
 * @param {boolean} [enabled=true]
 *   Pass `false` to stop listening (e.g. after OTP is already verified or unmounted).
 */
export default function useWebOtp(onOtpReceived, enabled = true) {
  const stableCallback = useCallback(onOtpReceived, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!enabled) return undefined;

    let isSubscribed = true;

    // 1. Android Native: Google Play Services SMS User Consent API
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
      AndroidSmsRetriever.retrieveSms()
        .then((result) => {
          if (!isSubscribed || !result?.message) return;
          const match = result.message.match(/(?:^|\D)(\d{4})(?:\D|$)/);
          if (match && match[1]) {
            stableCallback(match[1]);
          }
        })
        .catch((err) => {
          // User cancelled consent or timeout — silently ignore
          if (process.env.NODE_ENV !== 'production') {
            // eslint-disable-next-line no-console
            console.debug('[useWebOtp/AndroidSmsRetriever]', err?.message || err);
          }
        });

      return () => {
        isSubscribed = false;
      };
    }

    // 2. Web / Chrome: WebOTP API
    if (typeof window === 'undefined') return undefined;
    if (!('credentials' in navigator) || !window.OTPCredential) return undefined;

    const ac = new AbortController();

    navigator.credentials
      .get({ otp: { transport: ['sms'] }, signal: ac.signal })
      .then((credential) => {
        if (!isSubscribed) return;
        if (credential && credential.code) {
          stableCallback(String(credential.code).replace(/\D/g, ''));
        }
      })
      .catch((err) => {
        if (err && err.name !== 'AbortError' && err.name !== 'NotSupportedError') {
          if (process.env.NODE_ENV !== 'production') {
            // eslint-disable-next-line no-console
            console.debug('[useWebOtp] unexpected error:', err.name, err.message);
          }
        }
      });

    return () => {
      isSubscribed = false;
      ac.abort();
    };
  }, [enabled, stableCallback]);
}
