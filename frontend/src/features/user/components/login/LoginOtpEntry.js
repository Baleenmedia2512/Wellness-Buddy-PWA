// OTP entry step — 4 input cells (SMS OTP length).
// Auto-verifies when all digits are filled: no explicit Verify button required.
//
// Android + iOS: first cell uses autoComplete="one-time-code" so the OS can
//          show an SMS OTP suggestion; tap fills all cells via fillAll().
// Android: WebOTP API also listens when the SMS includes @domain #code.
// Web:     paste / manual typing — same auto-verify on completion.
//
// Important: ALL platform branches use real focusable inputs with
// inputMode="numeric". The custom InlineNumericKeypad is NOT used here because
// it sets readOnly + onFocus→blur() which prevents the OS from recognising OTP
// fields for autofill.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import useWebOtp from '../../hooks/useWebOtp';
import OtpInputCells from '../../../../shared/components/OtpInputCells.jsx';
import { scheduleFocusInputForKeyboard } from '../../../../shared/utils/focusInputForKeyboard.js';
import { nextOtpLastTried, shouldSubmitOtp } from '../../domain/otpAutoVerify';

const LoginOtpEntry = ({
  otpCtl, onVerify, loading, verified, errorMessage, successMessage,
  countdown, canResend, onResend, onBack,
}) => {
  const { otp, refs, isComplete, value, fillAll } = otpCtl;
  const [detectedOtp, setDetectedOtp] = useState('');
  const [showMessageTooltip, setShowMessageTooltip] = useState(false);

  // Auto-focus the first cell when the OTP screen mounts so the numeric
  // keyboard appears immediately and iOS QuickType can surface the OTP
  // suggestion without requiring an extra tap.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- refs.current is a stable ref object; mount-only focus is intentional
  useEffect(
    () => scheduleFocusInputForKeyboard(() => refs.current[0]),
    [],
  ); // eslint-disable-line react-hooks/exhaustive-deps

  // WebOTP API: when SMS arrives, store detected OTP and show tooltip
  const handleWebOtp = useCallback((code) => {
    if (code) {
      setDetectedOtp(code);
      setShowMessageTooltip(true);
    }
  }, []);

  // Show tooltip once message arrives (2.8s SMS transit time or on focus/clipboard/WebOTP)
  useEffect(() => {
    if (verified || isComplete) return undefined;

    const arrivalTimer = setTimeout(() => {
      setShowMessageTooltip(true);
    }, 2800);

    const checkClipboardForOtp = async () => {
      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
          const text = await navigator.clipboard.readText();
          if (text) {
            const trimmed = text.trim();
            const match = trimmed.match(/(?:^|\D)(\d{4})(?:\D|$)/);
            if (match && match[1]) {
              setDetectedOtp(match[1]);
              setShowMessageTooltip(true);
            }
          }
        }
      } catch {
        // Silently ignore clipboard permission errors
      }
    };

    const handleFocus = () => {
      setShowMessageTooltip(true);
      checkClipboardForOtp();
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      clearTimeout(arrivalTimer);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [verified, isComplete]);

  const handleAutofill = useCallback((codeToFill) => {
    const code = codeToFill || detectedOtp;
    if (!code) return;
    lastTriedRef.current = code;
    fillAll(code);
    setDetectedOtp('');
    setShowMessageTooltip(false);
    onVerify(code);
  }, [detectedOtp, fillAll, onVerify]);

  const handleAutofillFromMessages = async () => {
    if (detectedOtp) {
      handleAutofill(detectedOtp);
      return;
    }
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          const match = text.trim().match(/(?:^|\D)(\d{4})(?:\D|$)/);
          if (match && match[1]) {
            handleAutofill(match[1]);
            return;
          }
        }
      }
    } catch {
      // ignore clipboard permission error
    }
    refs.current[0]?.focus();
  };

  useWebOtp(handleWebOtp, !verified && !loading);

  // Auto-verify when the last digit is entered (typing, paste, or autofill).
  // Do not depend on `loading` going false after a failed attempt — that used
  // to resubmit the same wrong OTP in a loop and hide "Invalid OTP".
  const lastTriedRef = useRef('');
  useEffect(() => {
    const didSubmit = shouldSubmitOtp({
      isComplete, verified, loading, value, lastTried: lastTriedRef.current,
    });
    lastTriedRef.current = nextOtpLastTried({
      isComplete, value, lastTried: lastTriedRef.current, didSubmit,
    });
    if (didSubmit) onVerify(value);
  }, [isComplete, value, verified, loading, onVerify]);

  return (
    <div className="space-y-6">
      <div className="relative mx-auto w-fit">
        <style>{`
          @keyframes wv-tooltip-pop {
            from { opacity: 0; transform: translateY(-4px) scale(0.97); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }
        `}</style>

        <OtpInputCells
          otpCtl={otpCtl}
          length={otp.length}
          onComplete={(code) => onVerify(code)}
          className="flex justify-center gap-2 xs:gap-3"
          cellClassName="w-11 h-12 xs:w-12 xs:h-12 text-center text-xl xs:text-2xl font-bold border-2 rounded-lg focus:outline-none transition-all duration-300 hover:border-green-300 focus:border-green-400"
          cellStyle={(digit) => (digit
            ? { borderColor: '#4ade80', backgroundColor: '#f0fdf4' }
            : { borderColor: '#e5e7eb' })}
        />

        {/* Floating Tooltip anchored directly under the input boxes — only displays once message arrives */}
        {showMessageTooltip && !isComplete && !verified && (
          <div
            role="tooltip"
            onClick={handleAutofillFromMessages}
            className="absolute left-0 top-full mt-2.5 z-20 cursor-pointer select-none"
            style={{
              animation: 'wv-tooltip-pop 0.22s cubic-bezier(0.2, 0, 0, 1) forwards',
              minWidth: '185px',
            }}
          >
            {/* Top caret / arrow pointing up at the first cell */}
            <div
              className="absolute -top-1.5 left-5 w-3 h-3 bg-white border-t border-l border-gray-300/80 transform rotate-45"
              style={{ zIndex: 1 }}
            />

            {/* Tooltip Card Body (Native Android popup menu style) */}
            <div
              className="relative flex items-center gap-2.5 px-3 py-2 bg-white border border-gray-300/90 rounded-md shadow-md hover:bg-gray-50 active:bg-gray-100 transition-colors"
              style={{
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.16), 0 1px 3px rgba(0, 0, 0, 0.08)',
              }}
            >
              {/* Google Messages Logo */}
              <div
                className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: '#1a73e8' }}
              >
                <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z" />
                </svg>
              </div>

              <div className="leading-tight text-left">
                <div className="text-[13px] font-semibold text-gray-900 tracking-tight">
                  {detectedOtp ? `Autofill code: ${detectedOtp}` : 'Autofill code'}
                </div>
                <div className="text-[11px] text-gray-500 font-normal">
                  from Messages
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Status indicator — replaces the manual Verify button */}
      <div className="flex items-center justify-center min-h-[48px]">
        {verified ? (
          <span className="flex items-center space-x-2 text-green-700 font-medium">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <span>Verified!</span>
          </span>
        ) : loading ? (
          <span className="flex items-center space-x-2 text-gray-500 text-sm">
            <svg className="animate-spin h-4 w-4 text-green-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span>Verifying...</span>
          </span>
        ) : errorMessage ? (
          null
        ) : isComplete ? (
          <span className="text-sm text-gray-400">Verifying automatically…</span>
        ) : (
          <span className="text-sm text-gray-400">Enter the {otp.length}-digit code</span>
        )}
      </div>

      {errorMessage && <p className="mt-2 text-sm text-red-600 text-center" role="alert">{errorMessage}</p>}
      {successMessage && <p className="mt-2 text-sm text-green-600 text-center">{successMessage}</p>}

      <div className="text-center">
        {!canResend ? (
          <p className="text-sm text-gray-500">
            Resend OTP in <span className="font-medium text-green-500">{countdown}s</span>
          </p>
        ) : (
          <button onClick={onResend} disabled={loading}
            className="text-sm text-green-500 hover:text-green-700 font-medium transition-colors duration-200">
            Resend OTP
          </button>
        )}
      </div>
      <button onClick={onBack} className="w-full text-sm text-gray-500 hover:text-gray-700 transition-colors duration-200">
        ← Back
      </button>
    </div>
  );
};

export default LoginOtpEntry;
