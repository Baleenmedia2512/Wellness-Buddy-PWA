/**
 * Unit tests for useOtpInput hook.
 *
 * Coverage target: ≥ 85% lines / 75% branches (claude.md §9.1 hooks/).
 *
 * This hook is pure state — no I/O, no external dependencies.
 */
import { act, renderHook } from '@testing-library/react';
import useOtpInput from '../hooks/useOtpInput';

// ─── Initial state ────────────────────────────────────────────────────────────

describe('initial state', () => {
  it('initialises with empty array of the specified length', () => {
    const { result } = renderHook(() => useOtpInput(6));
    expect(result.current.otp).toHaveLength(6);
    expect(result.current.otp.every((d) => d === '')).toBe(true);
  });

  it('value is empty string when no digits entered', () => {
    const { result } = renderHook(() => useOtpInput(6));
    expect(result.current.value).toBe('');
  });

  it('isComplete is false when initialised', () => {
    const { result } = renderHook(() => useOtpInput(6));
    expect(result.current.isComplete).toBe(false);
  });
});

// ─── handleChange ─────────────────────────────────────────────────────────────

describe('handleChange', () => {
  it('sets a digit at the given index', () => {
    const { result } = renderHook(() => useOtpInput(6));
    act(() => { result.current.handleChange(0, '3'); });
    expect(result.current.otp[0]).toBe('3');
  });

  it('ignores non-digit input', () => {
    const { result } = renderHook(() => useOtpInput(6));
    act(() => { result.current.handleChange(0, 'a'); });
    expect(result.current.otp[0]).toBe('');
  });

  it('takes only the last digit when multiple chars are pasted via input event', () => {
    const { result } = renderHook(() => useOtpInput(6));
    act(() => { result.current.handleChange(0, '47'); });
    expect(result.current.otp[0]).toBe('7');
  });

  it('isComplete becomes true when all 6 digits are entered', () => {
    const { result } = renderHook(() => useOtpInput(6));
    act(() => {
      ['1','2','3','4','5','6'].forEach((d, i) => result.current.handleChange(i, d));
    });
    expect(result.current.isComplete).toBe(true);
    expect(result.current.value).toBe('123456');
  });
});

// ─── handleKeyDown ────────────────────────────────────────────────────────────

describe('handleKeyDown', () => {
  it('does nothing on non-backspace keys', () => {
    const { result } = renderHook(() => useOtpInput(6));
    // Should not throw
    expect(() =>
      act(() => result.current.handleKeyDown(0, { key: 'Enter' }))
    ).not.toThrow();
  });

  it('handles Backspace on first cell without error', () => {
    const { result } = renderHook(() => useOtpInput(6));
    act(() => { result.current.handleChange(0, '5'); });
    // Backspace on index 0 with empty value — cannot go further left
    expect(() =>
      act(() => result.current.handleKeyDown(0, { key: 'Backspace' }))
    ).not.toThrow();
  });

  it('does not crash when Backspace pressed on middle empty cell', () => {
    const { result } = renderHook(() => useOtpInput(6));
    // cell 2 is empty; cell 1 is empty — should attempt to focus cell 1
    expect(() =>
      act(() => result.current.handleKeyDown(2, { key: 'Backspace' }))
    ).not.toThrow();
  });
});

// ─── handlePaste ──────────────────────────────────────────────────────────────

describe('handlePaste', () => {
  const makePasteEvent = (text) => ({
    preventDefault: jest.fn(),
    clipboardData: { getData: jest.fn(() => text) },
  });

  it('fills all 6 cells from a digit-only paste', () => {
    const { result } = renderHook(() => useOtpInput(6));
    let returnValue;
    act(() => {
      returnValue = result.current.handlePaste(makePasteEvent('123456'));
    });
    expect(result.current.otp).toEqual(['1','2','3','4','5','6']);
    expect(returnValue).toBe('123456');
  });

  it('strips non-digit characters from pasted text', () => {
    const { result } = renderHook(() => useOtpInput(6));
    act(() => { result.current.handlePaste(makePasteEvent('1 2-3 4 5 6')); });
    expect(result.current.otp).toEqual(['1','2','3','4','5','6']);
  });

  it('returns null when paste is incomplete (< 6 digits)', () => {
    const { result } = renderHook(() => useOtpInput(6));
    let returnValue;
    act(() => {
      returnValue = result.current.handlePaste(makePasteEvent('123'));
    });
    expect(returnValue).toBeNull();
    expect(result.current.otp[0]).toBe('1');
    expect(result.current.otp[3]).toBe('');
  });

  it('ignores paste with no digits', () => {
    const { result } = renderHook(() => useOtpInput(6));
    let returnValue;
    act(() => {
      returnValue = result.current.handlePaste(makePasteEvent('abc'));
    });
    expect(returnValue).toBeNull();
    expect(result.current.otp.every((d) => d === '')).toBe(true);
  });

  it('calls preventDefault', () => {
    const { result } = renderHook(() => useOtpInput(6));
    const event = makePasteEvent('654321');
    act(() => { result.current.handlePaste(event); });
    expect(event.preventDefault).toHaveBeenCalled();
  });
});

// ─── handleKeypadDigit / handleKeypadBackspace ────────────────────────────────

describe('keypad handlers', () => {
  it('handleKeypadDigit fills the first empty slot', () => {
    const { result } = renderHook(() => useOtpInput(6));
    act(() => { result.current.handleKeypadDigit('7'); });
    expect(result.current.otp[0]).toBe('7');
    act(() => { result.current.handleKeypadDigit('8'); });
    expect(result.current.otp[1]).toBe('8');
  });

  it('handleKeypadDigit does nothing when all slots are filled', () => {
    const { result } = renderHook(() => useOtpInput(6));
    act(() => {
      ['1','2','3','4','5','6'].forEach((d) => result.current.handleKeypadDigit(d));
    });
    // Pressing another digit should not overflow
    expect(() =>
      act(() => result.current.handleKeypadDigit('9'))
    ).not.toThrow();
    expect(result.current.otp).toEqual(['1','2','3','4','5','6']);
  });

  it('handleKeypadBackspace removes the last filled digit', () => {
    const { result } = renderHook(() => useOtpInput(6));
    act(() => {
      ['1','2','3'].forEach((d) => result.current.handleKeypadDigit(d));
    });
    act(() => { result.current.handleKeypadBackspace(); });
    expect(result.current.otp[2]).toBe('');
    expect(result.current.otp[1]).toBe('2');
  });

  it('handleKeypadBackspace does nothing on empty OTP', () => {
    const { result } = renderHook(() => useOtpInput(6));
    expect(() =>
      act(() => result.current.handleKeypadBackspace())
    ).not.toThrow();
    expect(result.current.otp.every((d) => d === '')).toBe(true);
  });
});

// ─── reset ────────────────────────────────────────────────────────────────────

describe('reset', () => {
  it('clears all digits', () => {
    const { result } = renderHook(() => useOtpInput(6));
    act(() => {
      ['1','2','3','4','5','6'].forEach((d, i) => result.current.handleChange(i, d));
    });
    act(() => { result.current.reset(); });
    expect(result.current.otp.every((d) => d === '')).toBe(true);
    expect(result.current.isComplete).toBe(false);
  });
});

// ─── fillAll ─────────────────────────────────────────────────────────────────
// Used by WebOTP API auto-read and iOS autoComplete="one-time-code" autofill.

describe('fillAll', () => {
  it('fills all 6 cells and returns the complete OTP string', () => {
    const { result } = renderHook(() => useOtpInput(6));
    let returnValue;
    act(() => { returnValue = result.current.fillAll('123456'); });
    expect(result.current.otp).toEqual(['1','2','3','4','5','6']);
    expect(result.current.isComplete).toBe(true);
    expect(returnValue).toBe('123456');
  });

  it('strips non-digit characters before filling', () => {
    const { result } = renderHook(() => useOtpInput(6));
    let returnValue;
    act(() => { returnValue = result.current.fillAll('1 2-3 4 5 6'); });
    expect(result.current.otp).toEqual(['1','2','3','4','5','6']);
    expect(returnValue).toBe('123456');
  });

  it('truncates input longer than length', () => {
    const { result } = renderHook(() => useOtpInput(6));
    let returnValue;
    act(() => { returnValue = result.current.fillAll('12345678'); });
    expect(result.current.otp).toEqual(['1','2','3','4','5','6']);
    expect(returnValue).toBe('123456');
  });

  it('returns null when fewer than length digits are provided (partial fill)', () => {
    const { result } = renderHook(() => useOtpInput(6));
    let returnValue;
    act(() => { returnValue = result.current.fillAll('123'); });
    expect(result.current.otp[0]).toBe('1');
    expect(result.current.otp[3]).toBe('');
    expect(returnValue).toBeNull();
  });

  it('returns null and does not mutate state for empty input', () => {
    const { result } = renderHook(() => useOtpInput(6));
    let returnValue;
    act(() => { returnValue = result.current.fillAll(''); });
    expect(returnValue).toBeNull();
    expect(result.current.otp.every((d) => d === '')).toBe(true);
  });

  it('is idempotent when called twice with same value', () => {
    const { result } = renderHook(() => useOtpInput(6));
    act(() => { result.current.fillAll('123456'); });
    act(() => { result.current.fillAll('123456'); });
    expect(result.current.otp).toEqual(['1','2','3','4','5','6']);
  });
});
