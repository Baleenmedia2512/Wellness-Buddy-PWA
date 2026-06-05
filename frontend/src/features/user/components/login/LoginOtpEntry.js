// OTP entry step — 6 input cells, custom keypad on native, verify/resend/back.
import React from 'react';
import { Capacitor } from '@capacitor/core';
import InlineNumericKeypad from '../InlineNumericKeypad';

const isNative = Capacitor.isNativePlatform();

const LoginOtpEntry = ({
  otpCtl, onVerify, loading, verified, errorMessage, successMessage,
  countdown, canResend, onResend, onBack,
}) => {
  const { otp, refs, handleChange, handleKeyDown, handlePaste, handleKeypadDigit, handleKeypadBackspace } = otpCtl;
  const onCellChange = (e, index) => {
    if (isNative) return;
    handleChange(index, e.target.value);
    // eslint-disable-next-line react/prop-types -- JS project without PropTypes enforcement; types enforced at API boundary
    const next = [...otp]; next[index] = e.target.value.slice(-1);
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
            className={`w-11 h-12 xs:w-12 xs:h-12 text-center text-xl xs:text-2xl font-bold border-2 border-gray-200 rounded-lg focus:border-green-400 focus:outline-none transition-all duration-300 hover:border-green-300 ${isNative ? 'caret-transparent' : ''}`}
          />
        ))}
      </div>
      {isNative && <InlineNumericKeypad onDigit={onKeypadDigit} onBackspace={handleKeypadBackspace} />}
      <button
        onClick={() => onVerify(otp.join(''))}
        disabled={loading || otp.some((d) => d === '') || verified}
        className={`w-full flex items-center justify-center px-4 xs:px-6 py-3 xs:py-3.5 rounded-xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 min-h-[48px] ${
          verified ? 'bg-green-300 cursor-not-allowed'
                   : 'bg-gradient-to-r from-green-400 to-teal-400 text-white hover:shadow-md hover:from-green-500 hover:to-teal-500'
        }`}
      >
        {verified ? (
          <span className="flex items-center space-x-2">
            <svg className="w-5 h-5 text-green-800" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-green-800 font-medium">Verified</span>
          </span>
        ) : loading ? 'Verifying...' : 'Verify OTP'}
      </button>
      {errorMessage && <p className="mt-2 text-sm text-red-600 text-center">{errorMessage}</p>}
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
