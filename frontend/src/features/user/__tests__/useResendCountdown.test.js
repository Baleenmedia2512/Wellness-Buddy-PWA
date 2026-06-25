/**
 * Unit tests for useResendCountdown hook.
 *
 * Coverage target: ≥ 85% lines / 75% branches (claude.md §9.1 hooks/).
 *
 * Strategy: jest.useFakeTimers() — advances time without real waits.
 */
import { act, renderHook } from '@testing-library/react';
import useResendCountdown from '../hooks/useResendCountdown';

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

// ─── Initial state ────────────────────────────────────────────────────────────

describe('initial state', () => {
  it('defaults to countdown=60, canResend=false', () => {
    const { result } = renderHook(() => useResendCountdown());
    expect(result.current.countdown).toBe(60);
    expect(result.current.canResend).toBe(false);
  });

  it('respects custom initial seconds', () => {
    const { result } = renderHook(() => useResendCountdown(30));
    expect(result.current.countdown).toBe(30);
  });
});

// ─── active=false ─────────────────────────────────────────────────────────────

describe('when active=false', () => {
  it('does not decrement countdown', () => {
    const { result } = renderHook(() => useResendCountdown(60, false));
    act(() => { jest.advanceTimersByTime(5000); });
    expect(result.current.countdown).toBe(60);
    expect(result.current.canResend).toBe(false);
  });
});

// ─── active=true ──────────────────────────────────────────────────────────────

describe('when active=true', () => {
  it('decrements countdown each second', () => {
    const { result } = renderHook(() => useResendCountdown(5, true));
    act(() => { jest.advanceTimersByTime(1000); });
    expect(result.current.countdown).toBe(4);
    act(() => { jest.advanceTimersByTime(1000); });
    expect(result.current.countdown).toBe(3);
  });

  it('sets canResend=true when countdown reaches 0', () => {
    const { result } = renderHook(() => useResendCountdown(3, true));
    // Tick one second at a time — each act() flushes the resulting re-render
    // before the next timeout is registered.
    act(() => { jest.advanceTimersByTime(1000); }); // 2
    act(() => { jest.advanceTimersByTime(1000); }); // 1
    act(() => { jest.advanceTimersByTime(1000); }); // 0 → canResend=true
    expect(result.current.countdown).toBe(0);
    expect(result.current.canResend).toBe(true);
  });

  it('does not go below 0', () => {
    const { result } = renderHook(() => useResendCountdown(2, true));
    act(() => { jest.advanceTimersByTime(1000); }); // 1
    act(() => { jest.advanceTimersByTime(1000); }); // 0 → canResend=true
    act(() => { jest.advanceTimersByTime(1000); }); // no more ticks
    expect(result.current.countdown).toBe(0);
    expect(result.current.canResend).toBe(true);
  });
});

// ─── start() ──────────────────────────────────────────────────────────────────

describe('start()', () => {
  it('resets countdown to given seconds and canResend=false', () => {
    const { result } = renderHook(() => useResendCountdown(5, true));
    // Tick one at a time so React re-renders are flushed between each second
    act(() => { jest.advanceTimersByTime(1000); }); // 4
    act(() => { jest.advanceTimersByTime(1000); }); // 3
    act(() => { jest.advanceTimersByTime(1000); }); // 2
    act(() => { jest.advanceTimersByTime(1000); }); // 1
    act(() => { jest.advanceTimersByTime(1000); }); // 0 → canResend=true
    expect(result.current.canResend).toBe(true);

    act(() => { result.current.start(30); });
    expect(result.current.countdown).toBe(30);
    expect(result.current.canResend).toBe(false);
  });

  it('start(0) immediately sets canResend=true', () => {
    const { result } = renderHook(() => useResendCountdown(60));
    act(() => { result.current.start(0); });
    expect(result.current.countdown).toBe(0);
    expect(result.current.canResend).toBe(true);
  });

  it('start() with no argument resets to initial seconds', () => {
    const { result } = renderHook(() => useResendCountdown(10, true));
    act(() => { jest.advanceTimersByTime(5000); });
    act(() => { result.current.start(); });
    expect(result.current.countdown).toBe(10);
    expect(result.current.canResend).toBe(false);
  });
});
