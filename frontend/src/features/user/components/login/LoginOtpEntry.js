// OTP entry step — 6 input cells, custom keypad on native.
// Auto-verifies when all digits are filled: no explicit Verify button.
// Android: WebOTP API (navigator.credentials.get) auto-reads from SMS.
// iOS:     autoComplete="one-time-code" on first cell triggers keyboard suggestion;
//          paste handler + fillAll() fill all cells at once.
import React, { useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import InlineNumericKeypad from '../InlineNumericKeypad';
import useWebOtp from '../../hooks/useWebOtp';

const isNative = Capacitor.isNativePlatform();

const LoginOtpEntry = ({
  otpCtl, onVerify, loading, verified, errorMessage, successMessage,
  countdown, canResend, onResend, onBack,
}) => {
  const { otp, refs, handleChange, handleKeyDown, handlePaste, handleKeypadDigit, handleKeypadBackspace, fillAll } = otpCtl;
  const isComplete = otp.every((d) => d !== '');

  // WebOTP API: Android Chrome auto-reads the OTP from the SMS and populates
  // all cells + triggers verify without any user interaction.
  const handleWebOtp = useCallback((code) => {
    const filled = fillAll(code);
    if (filled) onVerify(filled);
  }, [fillAll, onVerify]);

  useWebOtp(handleWebOtp, !verified && !loading);

  const onCellChange = (e, index) => {
    if (isNative) return;
    const raw = e.target.value;
    // iOS autoComplete="one-time-code" delivers all OTP digits in a single
    // onChange on the first cell. Only trigger fillAll for complete-length
    // input so normal single-char rapid-typing is unaffected.
    if (raw.length >= otp.length) {
      const filled = fillAll(raw);
      if (filled) onVerify(filled);
      return;
    }
    handleChange(index, raw);
    const next = [...otp]; next[index] = raw.slice(-1);
    if (next.every((d) => d !== '')) onVerify(next.join(''));
  };
  const onKeypadDigit = (digit) => {
    handleKeypadDigit(digit);
    const filled = otp.findIndex((d) => d === '');
    if (filled === otp.length - 1) {
      const final = [...otp]; final[filled] = digit;
      onVerify(final.join(''));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-center gap-2 xs:gap-3">
        {otp.map((digit, index) => (
          <input
            key={index}
            ref={(el) => { refs.current[index] = el; }}
            type={isNative ? 'text' : 'tel'}
            inputMode={isNative ? 'none' : 'numeric'}
            pattern="[0-9]*"
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            readOnly={isNative} maxLength={1} value={digit}
            onChange={(e) => onCellChange(e, index)}
            onKeyDown={(e) => !isNative && handleKeyDown(index, e)}
            onPaste={(e) => { if (!isNative) { const v = handlePaste(e); if (v) onVerify(v); } }}
            onFocus={isNative ? (e) => e.target.blur() : undefined}
            onContextMenu={isNative ? (e) => e.preventDefault() : undefined}
            className={`w-11 h-12 xs:w-12 xs:h-12 text-center text-xl xs:text-2xl font-bold border-2 rounded-lg focus:outline-none transition-all duration-300 ${
              digit ? 'border-green-400 bg-green-50' : 'border-gray-200 hover:border-green-300'
            } ${isNative ? 'caret-transparent' : ''}`}
          />
        ))}
      </div>
      {isNative && <InlineNumericKeypad onDigit={onKeypadDigit} onBackspace={handleKeypadBackspace} />}

      {/* Auto-verify status — replaces the manual Verify button */}
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
        ) : isComplete ? (
          <span className="text-sm text-gray-400">Verifying automatically…</span>
        ) : (
          <span className="text-sm text-gray-400">Enter the 6-digit code</span>
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
