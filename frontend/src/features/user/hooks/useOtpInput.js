// 6-digit OTP input controller — supports native keyboard, custom keypad, paste.
import { useRef, useState } from 'react';

export default function useOtpInput(length = 6) {
  const [otp, setOtp] = useState(() => new Array(length).fill(''));
  const refs = useRef([]);

  const value = otp.join('');
  const isComplete = otp.every((d) => d !== '');

  const reset = () => {
    setOtp(new Array(length).fill(''));
  };

  const handleChange = (idx, raw) => {
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
    otp, setOtp, refs, value, isComplete, reset,
    handleChange, handleKeyDown, handlePaste,
    handleKeypadDigit, handleKeypadBackspace,
  };
}
