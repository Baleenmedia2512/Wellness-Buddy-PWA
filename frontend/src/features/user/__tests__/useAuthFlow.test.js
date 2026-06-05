/**
 * Unit tests for useAuthFlow hook.
 *
 * Coverage target: ≥ 85% lines / 75% branches (claude.md §9.1 hooks/).
 *
 * Strategy:
 *  - Mock authService at the module boundary (no real HTTP).
 *  - Use jest.useFakeTimers() for the setTimeout inside verifyOtp.
 *  - Domain rule: loading, errorMessage, successMessage, otpSent, verified
 *    are all managed here. No I/O reaches the component.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import useAuthFlow from '../hooks/useAuthFlow';
import * as authService from '../services/authService';

jest.mock('../services/authService', () => ({
  sendOtp: jest.fn(),
  verifyOtp: jest.fn(),
}));

// Phone path uses Firebase under the hood — mock at the boundary so Jest
// never imports the real Firebase web SDK.
jest.mock('../services/phoneAuthService', () => ({
  sendPhoneOtp: jest.fn(),
  confirmPhoneOtp: jest.fn(),
  exchangeFirebaseIdToken: jest.fn(),
  resetPhoneAuth: jest.fn(),
}));

afterEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
});

// ─── sendOtp ─────────────────────────────────────────────────────────────────

describe('sendOtp', () => {
  it('sets otpSent=true and returns true on success', async () => {
    authService.sendOtp.mockResolvedValue({ success: true });
    const { result } = renderHook(() => useAuthFlow({}));

    act(() => { result.current.setEmail('test@example.com'); });

    let returnValue;
    await act(async () => { returnValue = await result.current.sendOtp(); });

    expect(returnValue).toBe(true);
    expect(result.current.otpSent).toBe(true);
    expect(result.current.errorMessage).toBe('');
    expect(result.current.loading).toBe(false);
  });

  it('sets errorMessage and returns false when server returns success=false', async () => {
    authService.sendOtp.mockResolvedValue({ success: false, message: 'Too many attempts' });
    const { result } = renderHook(() => useAuthFlow({}));
    act(() => { result.current.setEmail('test@example.com'); });

    let returnValue;
    await act(async () => { returnValue = await result.current.sendOtp(); });

    expect(returnValue).toBe(false);
    expect(result.current.otpSent).toBe(false);
    expect(result.current.errorMessage).toBe('Too many attempts');
    expect(result.current.loading).toBe(false);
  });

  it('sets default errorMessage on network error', async () => {
    authService.sendOtp.mockRejectedValue(new Error('Network error'));
    const { result } = renderHook(() => useAuthFlow({}));
    act(() => { result.current.setEmail('test@example.com'); });

    let returnValue;
    await act(async () => { returnValue = await result.current.sendOtp(); });

    expect(returnValue).toBe(false);
    expect(result.current.errorMessage).toBe('Failed to send OTP. Please try again.');
    expect(result.current.loading).toBe(false);
  });

  it('sets loading=true during the call then false after', async () => {
    let resolve;
    authService.sendOtp.mockReturnValue(new Promise((r) => { resolve = r; }));
    const { result } = renderHook(() => useAuthFlow({}));
    act(() => { result.current.setEmail('test@example.com'); });

    act(() => { result.current.sendOtp(); });
    expect(result.current.loading).toBe(true);

    await act(async () => { resolve({ success: true }); });
    expect(result.current.loading).toBe(false);
  });
});

// ─── verifyOtp ────────────────────────────────────────────────────────────────

describe('verifyOtp', () => {
  it('sets verified=true and calls onOtpVerified after 1.5s on success', async () => {
    jest.useFakeTimers();
    const onOtpVerified = jest.fn().mockResolvedValue(undefined);
    authService.verifyOtp.mockResolvedValue({
      success: true,
      user: { id: 1, email: 'test@example.com' },
      isNewUser: false,
    });

    const { result } = renderHook(() => useAuthFlow({ onOtpVerified }));
    act(() => { result.current.setEmail('test@example.com'); });

    let returnValue;
    await act(async () => { returnValue = await result.current.verifyOtp('123456'); });

    expect(returnValue).toBe(true);
    expect(result.current.verified).toBe(true);
    expect(result.current.successMessage).toBe('OTP verified successfully!');
    expect(onOtpVerified).not.toHaveBeenCalled(); // still waiting for timeout

    await act(async () => { jest.advanceTimersByTime(1500); });
    expect(onOtpVerified).toHaveBeenCalledWith(false);
  });

  it('passes isNewUser=true to onOtpVerified when server signals new user', async () => {
    jest.useFakeTimers();
    const onOtpVerified = jest.fn().mockResolvedValue(undefined);
    authService.verifyOtp.mockResolvedValue({
      success: true,
      user: { id: 2, email: 'new@example.com' },
      isNewUser: true,
    });

    const { result } = renderHook(() => useAuthFlow({ onOtpVerified }));

    await act(async () => { await result.current.verifyOtp('654321'); });
    await act(async () => { jest.advanceTimersByTime(1500); });

    expect(onOtpVerified).toHaveBeenCalledWith(true);
  });

  it('sets errorMessage and returns false on invalid OTP', async () => {
    authService.verifyOtp.mockResolvedValue({ success: false, message: 'Invalid OTP' });
    const { result } = renderHook(() => useAuthFlow({}));

    let returnValue;
    await act(async () => { returnValue = await result.current.verifyOtp('000000'); });

    expect(returnValue).toBe(false);
    expect(result.current.verified).toBe(false);
    expect(result.current.errorMessage).toBe('Invalid OTP');
  });

  it('sets default errorMessage on network error', async () => {
    authService.verifyOtp.mockRejectedValue(new Error('timeout'));
    const { result } = renderHook(() => useAuthFlow({}));

    let returnValue;
    await act(async () => { returnValue = await result.current.verifyOtp('111111'); });

    expect(returnValue).toBe(false);
    expect(result.current.errorMessage).toBe('Failed to verify OTP. Please try again.');
  });

  it('stores user data in localStorage on success', async () => {
    jest.useFakeTimers();
    authService.verifyOtp.mockResolvedValue({
      success: true,
      user: { id: 5, email: 'store@example.com' },
      isNewUser: false,
    });

    const { result } = renderHook(() => useAuthFlow({}));
    await act(async () => { await result.current.verifyOtp('999999'); });

    const stored = JSON.parse(localStorage.getItem('otpUser'));
    expect(stored.id).toBe(5);
    expect(stored.isNewUser).toBe(false);
  });

  it('regression: stores isNewUser=true in localStorage for new OTP users', async () => {
    // Regression guard for BUG: handleOtpVerified skipped checkProfileCompletion for
    // new users, so the forced profile detail gate never appeared.
    // Fix: checkProfileCompletion is now called unconditionally in handleOtpVerified.
    // This test verifies useAuthFlow correctly propagates isNewUser=true so the
    // App-level consumer can apply the fix.
    jest.useFakeTimers();
    const onOtpVerified = jest.fn().mockResolvedValue(undefined);
    authService.verifyOtp.mockResolvedValue({
      success: true,
      user: { id: 99, email: 'brand-new@example.com' },
      isNewUser: true,
    });

    const { result } = renderHook(() => useAuthFlow({ onOtpVerified }));
    await act(async () => { await result.current.verifyOtp('123456'); });
    await act(async () => { jest.advanceTimersByTime(1500); });

    // hook must pass isNewUser=true to the App-level handler
    expect(onOtpVerified).toHaveBeenCalledWith(true);
    // localStorage must also carry the flag so handleOtpVerified can read it
    const stored = JSON.parse(localStorage.getItem('otpUser'));
    expect(stored.isNewUser).toBe(true);
    expect(stored.email).toBe('brand-new@example.com');
  });
});

// ─── resetOtpScreen ───────────────────────────────────────────────────────────

describe('resetOtpScreen', () => {
  it('resets otpSent and clears errorMessage', async () => {
    authService.sendOtp.mockResolvedValue({ success: true });
    const { result } = renderHook(() => useAuthFlow({}));
    act(() => { result.current.setEmail('test@example.com'); });

    await act(async () => { await result.current.sendOtp(); });
    expect(result.current.otpSent).toBe(true);

    act(() => { result.current.resetOtpScreen(); });

    expect(result.current.otpSent).toBe(false);
    expect(result.current.errorMessage).toBe('');
  });

  it('can be called safely when nothing was sent', () => {
    const { result } = renderHook(() => useAuthFlow({}));
    expect(() => act(() => result.current.resetOtpScreen())).not.toThrow();
  });
});
