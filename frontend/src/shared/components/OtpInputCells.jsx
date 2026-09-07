/**
 * Multi-cell OTP input — shared paste, autofill, and manual typing behaviour.
 * Bulk input (paste / OS autofill) is intercepted before per-cell maxLength truncates it.
 */
import React from 'react';
import { isOtpBulkInputType } from '../../features/user/domain/otpInputPaste';
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
  const { otp, refs, handleChange, handleKeyDown, fillAll } = otpCtl;

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

  const onCellBeforeInput = (e) => {
    if (!isOtpBulkInputType(e.inputType)) return;
    const data = e.data ?? '';
    if (!data) return;
    e.preventDefault();
    dispatchMultiDigit(data);
  };

  const onCellPaste = (e) => {
    e.preventDefault();
    const fromEvent = e.clipboardData?.getData('text') ?? '';
    if (fromEvent) {
      dispatchMultiDigit(fromEvent);
      return;
    }
    // iOS / Capacitor WebView: clipboardData is sometimes empty on long-press paste.
    if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
      navigator.clipboard.readText()
        .then((text) => {
          if (text) dispatchMultiDigit(text);
        })
        .catch(() => {
          // Permission denied or unsupported — ignore.
        });
    }
  };

  // Android WebViews may deliver autofill only via input/change after beforeinput.
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
          data-no-select-all="true"
          ref={(el) => { refs.current[index] = el; }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={otpAutoCompleteForCell(index, length, { emailOtp })}
          maxLength={otpMaxLengthForCell(index, length)}
          value={digit}
          onChange={(e) => onCellChange(index, e.target.value)}
          onBeforeInput={onCellBeforeInput}
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
