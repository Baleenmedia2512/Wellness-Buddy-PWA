// WebOTP API hook — auto-reads a one-time password from an incoming SMS.
//
// Platform behaviour:
//   Android Chrome / Capacitor WebView: `navigator.credentials.get({ otp })` is
//     supported and matches SMSes that contain a final line in the format:
//     `@<domain> #<otp-code>`  (SMS Retriever-style without the app hash).
//
//   iOS Safari: autoComplete="one-time-code" on the input handles autofill at
//     the OS level — this hook is a no-op on iOS; the OTP screen's paste
//     handler catches the suggestion-tap event instead.
//
//   Other browsers: hook is a no-op (credentials.get throws NotSupportedError
//     which is silently caught).
//
// Note: India DLT-approved SMS templates are immutable. If the MDT template
// does not end with `\n@<domain> #<code>`, WebOTP will not fire. In that case
// users paste manually or tap the iOS autofill suggestion. Future: coordinate
// with MDT to add a non-DLT supplementary line, or switch to a Firebase/Twilio
// provider that supports the WebOTP hash format.
import { useCallback, useEffect } from 'react';

/**
 * @param {(code: string) => void} onOtpReceived
 *   Called with the raw OTP string (digits only) when the browser auto-reads
 *   it from an incoming SMS.  Only called once per mount.
 * @param {boolean} [enabled=true]
 *   Pass `false` to stop listening (e.g. after OTP is already verified or
 *   the screen is unmounted).
 */
export default function useWebOtp(onOtpReceived, enabled = true) {
  // Stable reference so the effect dependency is safe.
  const stableCallback = useCallback(onOtpReceived, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!enabled) return undefined;
    // WebOTP API requires `window.OTPCredential` to exist.
    if (typeof window === 'undefined') return undefined;
    if (!('credentials' in navigator) || !window.OTPCredential) return undefined;

    const ac = new AbortController();

    navigator.credentials
      .get({ otp: { transport: ['sms'] }, signal: ac.signal })
      .then((credential) => {
        if (credential && credential.code) {
          stableCallback(String(credential.code).replace(/\D/g, ''));
        }
      })
      .catch((err) => {
        // AbortError = intentional cleanup. NotSupportedError = browser doesn't
        // support OTP credential type. Both are expected; swallow silently.
        if (err && err.name !== 'AbortError' && err.name !== 'NotSupportedError') {
          // Unexpected error — log at debug level only; do not surface to user.
          // eslint-disable-next-line no-console -- intentional debug, not shipped in prod
          if (process.env.NODE_ENV !== 'production') {
            // eslint-disable-next-line no-console
            console.debug('[useWebOtp] unexpected error:', err.name, err.message);
          }
        }
      });

    return () => ac.abort();
  }, [enabled, stableCallback]);
}
