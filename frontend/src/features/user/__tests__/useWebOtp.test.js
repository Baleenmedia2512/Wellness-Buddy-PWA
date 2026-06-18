/**
 * Unit tests for useWebOtp hook.
 *
 * The hook wraps navigator.credentials.get({ otp }) — the WebOTP API.
 * Since jsdom doesn't implement this API, all calls are mocked.
 */
import { act, renderHook } from '@testing-library/react';
import useWebOtp from '../hooks/useWebOtp';

// ─── Helpers ──────────────────────────────────────────────────────────────────

let aborted = false;

const makeCredentialsMock = (resolveWith) => ({
  get: jest.fn(() => new Promise((resolve, reject) => {
    if (resolveWith === 'abort') {
      // Simulate abort
      reject(Object.assign(new Error('AbortError'), { name: 'AbortError' }));
    } else if (resolveWith === 'notSupported') {
      reject(Object.assign(new Error('NotSupportedError'), { name: 'NotSupportedError' }));
    } else if (resolveWith instanceof Error) {
      reject(resolveWith);
    } else {
      resolve(resolveWith);
    }
  })),
});

beforeEach(() => {
  aborted = false;
  // Provide window.OTPCredential so the hook knows the API is available
  window.OTPCredential = class {};
  // Default: hook succeeds with code '123456'
  Object.defineProperty(navigator, 'credentials', {
    value: makeCredentialsMock({ code: '123456' }),
    configurable: true,
    writable: true,
  });
});

afterEach(() => {
  delete window.OTPCredential;
});

// ─── API availability guard ───────────────────────────────────────────────────

describe('API availability', () => {
  it('does not call credentials.get when OTPCredential is not available', () => {
    delete window.OTPCredential;
    const get = jest.fn().mockResolvedValue({ code: '111111' });
    Object.defineProperty(navigator, 'credentials', { value: { get }, configurable: true });

    renderHook(() => useWebOtp(jest.fn(), true));
    expect(get).not.toHaveBeenCalled();
  });

  it('does not call credentials.get when enabled=false', async () => {
    const get = jest.fn().mockResolvedValue({ code: '111111' });
    Object.defineProperty(navigator, 'credentials', { value: { get }, configurable: true });

    renderHook(() => useWebOtp(jest.fn(), false));
    expect(get).not.toHaveBeenCalled();
  });
});

// ─── Success path ─────────────────────────────────────────────────────────────

describe('success', () => {
  it('calls onOtpReceived with the OTP code when credential resolves', async () => {
    const onOtpReceived = jest.fn();
    renderHook(() => useWebOtp(onOtpReceived, true));
    // Allow the microtask queue to flush
    await act(async () => {});
    expect(onOtpReceived).toHaveBeenCalledWith('123456');
  });

  it('strips non-digit characters from the credential code', async () => {
    Object.defineProperty(navigator, 'credentials', {
      value: makeCredentialsMock({ code: '12 34-56' }),
      configurable: true,
    });
    const onOtpReceived = jest.fn();
    renderHook(() => useWebOtp(onOtpReceived, true));
    await act(async () => {});
    expect(onOtpReceived).toHaveBeenCalledWith('123456');
  });

  it('does not call onOtpReceived when credential has no code', async () => {
    Object.defineProperty(navigator, 'credentials', {
      value: makeCredentialsMock({ code: '' }),
      configurable: true,
    });
    const onOtpReceived = jest.fn();
    renderHook(() => useWebOtp(onOtpReceived, true));
    await act(async () => {});
    expect(onOtpReceived).not.toHaveBeenCalled();
  });

  it('does not call onOtpReceived when credential is null', async () => {
    Object.defineProperty(navigator, 'credentials', {
      value: makeCredentialsMock(null),
      configurable: true,
    });
    const onOtpReceived = jest.fn();
    renderHook(() => useWebOtp(onOtpReceived, true));
    await act(async () => {});
    expect(onOtpReceived).not.toHaveBeenCalled();
  });
});

// ─── Error paths ──────────────────────────────────────────────────────────────

describe('silent error handling', () => {
  it('swallows AbortError without calling onOtpReceived', async () => {
    Object.defineProperty(navigator, 'credentials', {
      value: makeCredentialsMock('abort'),
      configurable: true,
    });
    const onOtpReceived = jest.fn();
    expect(() => renderHook(() => useWebOtp(onOtpReceived, true))).not.toThrow();
    await act(async () => {});
    expect(onOtpReceived).not.toHaveBeenCalled();
  });

  it('swallows NotSupportedError without calling onOtpReceived', async () => {
    Object.defineProperty(navigator, 'credentials', {
      value: makeCredentialsMock('notSupported'),
      configurable: true,
    });
    const onOtpReceived = jest.fn();
    expect(() => renderHook(() => useWebOtp(onOtpReceived, true))).not.toThrow();
    await act(async () => {});
    expect(onOtpReceived).not.toHaveBeenCalled();
  });
});

// ─── Cleanup ──────────────────────────────────────────────────────────────────

describe('cleanup', () => {
  it('aborts the credentials request on unmount', () => {
    let capturedSignal;
    const get = jest.fn(({ signal }) => {
      capturedSignal = signal;
      return new Promise(() => {}); // never resolves
    });
    Object.defineProperty(navigator, 'credentials', { value: { get }, configurable: true });

    const { unmount } = renderHook(() => useWebOtp(jest.fn(), true));
    unmount();
    expect(capturedSignal.aborted).toBe(true);
  });
});
