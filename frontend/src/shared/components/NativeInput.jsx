/**
 * NativeInput.jsx
 *
 * Platform-aware <input> wrapper for numeric / OTP / phone fields.
 * On Android WebView uses type="tel" (dial pad); on iOS uses type="text"
 * + inputmode. Writes attributes to the live DOM via setAttribute.
 */
import React, { forwardRef, useLayoutEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  applyNativeKeyboardAttrs,
  mergeNativeInputRef,
  resolveNativeKeyboardAttrs,
} from '../utils/nativeInputMode.js';

const NativeInput = forwardRef(function NativeInput(
  {
    inputMode,
    pattern,
    autoComplete,
    type = 'text',
    otp = false,
    ...rest
  },
  forwardedRef,
) {
  const innerRef = useRef(null);

  const resolved = resolveNativeKeyboardAttrs({
    inputMode,
    type,
    autoComplete,
    pattern,
    isOtp: otp,
  });

  // Re-apply every render — React may reset type from the JSX prop on commit.
  useLayoutEffect(() => {
    applyNativeKeyboardAttrs(innerRef.current, {
      inputMode,
      type,
      autoComplete,
      pattern,
      isOtp: otp,
    });
  });

  const setRef = mergeNativeInputRef((el) => {
    innerRef.current = el;
    if (typeof forwardedRef === 'function') {
      forwardedRef(el);
    } else if (forwardedRef) {
      forwardedRef.current = el;
    }
  });

  return (
    <input
      ref={setRef}
      data-otp={otp ? 'true' : undefined}
      type={resolved.type}
      inputMode={resolved.inputMode}
      pattern={resolved.pattern}
      autoComplete={resolved.autoComplete}
      {...rest}
    />
  );
});

/** OTP first cell: one-time-code on iOS and email OTP on all platforms. */
export function otpAutoCompleteForCell(index, length = 6, { emailOtp = false } = {}) {
  if (index !== 0) return 'off';
  if (emailOtp || Capacitor.getPlatform() === 'ios') return 'one-time-code';
  return 'off';
}

/** First OTP cell must accept the full code — maxLength=1 truncates paste/autofill. */
export function otpMaxLengthForCell(index, length = 6, { emailOtp = false } = {}) {
  if (index !== 0) return 1;
  if (emailOtp || Capacitor.getPlatform() === 'ios') return length;
  return 1;
}

export default NativeInput;
