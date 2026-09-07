// OTP input controller — supports native keyboard, custom keypad, paste,
// WebOTP API auto-fill, and iOS autoComplete="one-time-code" multi-char input.
import { useRef, useState } from 'react';
import { SMS_OTP_LENGTH } from '../domain/otpLength';
import { resolveOtpDigits } from '../domain/otpInputPaste';

export default function useOtpInput(length = SMS_OTP_LENGTH) {
  const [otp, setOtp] = useState(() => new Array(length).fill(''));
  const refs = useRef([]);

  const value = otp.join('');
  const isComplete = otp.every((d) => d !== '');

  const reset = () => {
    setOtp(new Array(length).fill(''));
  };

  const applyDigits = (digits) => {
    const clean = String(digits ?? '').replace(/\D/g, '').slice(0, length);
    if (!clean) return null;
    const next = new Array(length).fill('');
    clean.split('').forEach((d, i) => { next[i] = d; });
    setOtp(next);
    refs.current[Math.min(clean.length, length - 1)]?.focus();
    return clean.length === length ? clean : null;
  };

  /**
   * Fill all cells at once — used by WebOTP API auto-read, iOS autofill,
   * clipboard paste, and prose such as "Your OTP is 1234".
   */
  const fillAll = (raw) => applyDigits(resolveOtpDigits(raw, length));

  const handleChange = (idx, raw) => {
    const text = String(raw ?? '');
    // Autofill, paste-as-typing, and multi-char input (all platforms).
    if (text.length > 1) {
      fillAll(text);
      return;
    }
    if (!/^\d*$/.test(text)) return;
    const v = text.slice(-1);
    setOtp((prev) => {
      const next = [...prev];
      next[idx] = v;
      return next;
    });
    if (v && idx < length - 1) refs.current[idx + 1]?.focus();
  };

  const handleKeyDown = (idx, e) => {
    if (e.key !== 'Backspace') return;
    if (otp[idx] !== '') return;
    if (idx <= 0) return;
    e.preventDefault();
    setOtp((prev) => {
      const next = [...prev];
      next[idx - 1] = '';
      return next;
    });
    refs.current[idx - 1]?.focus();
  };

  const handlePaste = (e) => {
    if (e?.preventDefault) e.preventDefault();
    const pasted = e?.clipboardData?.getData('text') ?? String(e ?? '');
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
