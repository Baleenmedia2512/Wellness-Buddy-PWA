/**
 * Multi-cell OTP input — shared paste, autofill, and manual typing behaviour.
 * First cell accepts the full code length so OS autofill / paste is not truncated.
 */
import React from 'react';
import NativeInput, { otpAutoCompleteForCell, otpMaxLengthForCell } from './NativeInput.jsx';

/**
 * @param {{
 *   otpCtl: ReturnType<typeof import('../../features/user/hooks/useOtpInput').default>,
 *   length: number,
 *   emailOtp?: boolean,
 *   disabled?: boolean,
 *   className?: string,
 *   cellClassName?: string,
 *   cellStyle?: (digit: string) => React.CSSProperties | undefined,
 *   onComplete?: (code: string) => void,
 * }} props
 */
export default function OtpInputCells({
  otpCtl,
  length,
  emailOtp = false,
  disabled = false,
  className = 'flex justify-center gap-2',
  cellClassName = '',
  cellStyle,
  onComplete,
}) {
  const { otp, refs, handleChange, handleKeyDown, handlePaste, fillAll } = otpCtl;

  const dispatchMultiDigit = (raw) => {
    const filled = fillAll(raw);
    if (filled && onComplete) onComplete(filled);
  };

  const onCellChange = (index, raw) => {
    if (String(raw ?? '').length > 1) {
      dispatchMultiDigit(raw);
      return;
    }
    handleChange(index, raw);
  };

  const onCellPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData?.getData('text') ?? '';
    dispatchMultiDigit(pasted);
  };

  // Some Android WebViews deliver autofill via input before/on change.
  const onCellInput = (e) => {
    const raw = e.currentTarget.value;
    if (raw.length > 1) dispatchMultiDigit(raw);
  };

  return (
    <div className={className}>
      {otp.map((digit, index) => (
        <NativeInput
          key={index}
          otp
          ref={(el) => { refs.current[index] = el; }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={otpAutoCompleteForCell(index, length, { emailOtp })}
          maxLength={otpMaxLengthForCell(index, length)}
          value={digit}
          onChange={(e) => onCellChange(index, e.target.value)}
          onInput={onCellInput}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={onCellPaste}
          disabled={disabled}
          className={cellClassName}
          style={cellStyle?.(digit)}
        />
      ))}
    </div>
  );
}
