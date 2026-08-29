// OTP input controller — supports native keyboard, custom keypad, paste,
// WebOTP API auto-fill, and iOS autoComplete="one-time-code" multi-char input.
import { useRef, useState } from 'react';
import { extractOtpFromText } from '../domain/otpLength';

export default function useOtpInput(length = 6) {
  const [otp, setOtp] = useState(() => new Array(length).fill(''));
  const refs = useRef([]);

  const value = otp.join('');
  const isComplete = otp.every((d) => d !== '');

  const reset = () => {
    setOtp(new Array(length).fill(''));
  };

  const applyDigits = (digits) => {
    if (!digits) return null;
    const next = new Array(length).fill('');
    digits.split('').forEach((d, i) => { next[i] = d; });
    setOtp(next);
    refs.current[Math.min(digits.length, length - 1)]?.focus();
    return digits.length === length ? digits : null;
  };

  /**
   * Fill all cells at once — used by WebOTP API auto-read, iOS autofill,
   * clipboard paste, and prose such as "Your OTP is 1234".
   */
  const fillAll = (raw) => {
    const digits = extractOtpFromText(raw, length);
    return applyDigits(digits);
  };

  const handleChange = (idx, raw) => {
    const extracted = extractOtpFromText(raw, length);
    if (extracted) {
      fillAll(extracted);
      return;
    }
    if (raw.length >= length) {
      fillAll(raw);
      return;
    }
    if (!/^\d*$/.test(raw)) return;
    const v = raw.slice(-1);
    setOtp((prev) => {
      const next = [...prev];
      next[idx] = v;
      return next;
    });
    if (v && idx < length - 1) refs.current[idx + 1]?.focus();
  };

  const handleKeyDown = (idx, e) => {
    if (e.key === 'Backspace' && otp[idx] === '' && idx > 0) {
      refs.current[idx - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData?.getData('text') ?? '';
    return fillAll(pasted);
  };

  const handleKeypadDigit = (digit) => {
    setOtp((prev) => {
      const idx = prev.findIndex((d) => d === '');
      if (idx === -1) return prev;
      const next = [...prev];
      next[idx] = digit;
      return next;
    });
  };

  const handleKeypadBackspace = () => {
    setOtp((prev) => {
      const next = [...prev];
      for (let i = next.length - 1; i >= 0; i--) {
        if (next[i] !== '') { next[i] = ''; break; }
      }
      return next;
    });
  };

  return {
    otp, setOtp, refs, value, isComplete, reset, fillAll,
    handleChange, handleKeyDown, handlePaste,
    handleKeypadDigit, handleKeypadBackspace,
  };
}
