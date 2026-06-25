// 6-digit OTP input controller — supports native keyboard, custom keypad, paste,
// WebOTP API auto-fill, and iOS autoComplete="one-time-code" multi-char input.
import { useRef, useState } from 'react';

export default function useOtpInput(length = 6) {
  const [otp, setOtp] = useState(() => new Array(length).fill(''));
  const refs = useRef([]);

  const value = otp.join('');
  const isComplete = otp.every((d) => d !== '');

  const reset = () => {
    setOtp(new Array(length).fill(''));
  };

  /**
   * Fill all cells at once — used by WebOTP API auto-read and iOS autofill
   * when the system delivers multiple digits into a single onChange event.
   * Returns the full OTP string when exactly `length` digits were provided,
   * otherwise returns null (partial fill — caller decides what to do).
   */
  const fillAll = (raw) => {
    const digits = String(raw || '').replace(/\D/g, '').slice(0, length);
    if (!digits) return null;
    const next = new Array(length).fill('');
    digits.split('').forEach((d, i) => { next[i] = d; });
    setOtp(next);
    refs.current[Math.min(digits.length, length - 1)]?.focus();
    return digits.length === length ? digits : null;
  };

  const handleChange = (idx, raw) => {
    // iOS autoComplete="one-time-code" autofill delivers ALL `length` digits
    // into the first cell as a single onChange (e.g. value = "123456").
    // Only delegate to fillAll when the raw string is >= length chars so that
    // normal single-char rapid-typing (e.g. raw = "47" from a fast keypress)
    // falls through to the existing slice(-1) behaviour.
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
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!pasted) return null;
    const next = new Array(length).fill('');
    pasted.split('').forEach((d, i) => { next[i] = d; });
    setOtp(next);
    refs.current[Math.min(pasted.length, length - 1)]?.focus();
    return next.every((d) => d !== '') ? next.join('') : null;
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
