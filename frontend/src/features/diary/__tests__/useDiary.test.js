/**
 * frontend/src/features/diary/__tests__/useDiary.test.js
 *
 * Unit tests for `useDiary`. The `fetchDiary` client is mocked at the
 * module boundary so this suite stays pure and fast (no axios, no
 * network).
 */
import { renderHook, act, waitFor } from '@testing-library/react';

jest.mock('../api/diaryClient', () => ({
  fetchDiary: jest.fn(),
}));

import { useDiary, toYmd } from '../hooks/useDiary';
import { fetchDiary } from '../api/diaryClient';

const samplePayload = {
  date: '2026-06-05',
  ownerUserId: '42',
  isSelf: true,
  includesUnknown: false,
  entries: [{ kind: 'food', capturedAt: '2026-06-05T10:00:00+05:30', capture: null, payload: { id: 1 } }],
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useDiary — happy path', () => {
  it('returns loading while the request is in flight, then data', async () => {
    fetchDiary.mockResolvedValueOnce(samplePayload);
    const { result } = renderHook(() =>
      useDiary({ ownerUserId: '42', viewerUserId: '42', date: '2026-06-05' }),
    );
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual(samplePayload);
    expect(result.current.error).toBeNull();
    expect(fetchDiary).toHaveBeenCalledTimes(1);
  });

  it('re-fetches when ownerUserId / viewerUserId / date changes', async () => {
    fetchDiary.mockResolvedValue(samplePayload);
    const { result, rerender } = renderHook(
      ({ d }) => useDiary({ ownerUserId: '42', viewerUserId: '42', date: d }),
      { initialProps: { d: '2026-06-04' } },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    rerender({ d: '2026-06-05' });
    await waitFor(() => expect(fetchDiary).toHaveBeenCalledTimes(2));
  });

  it('refresh() triggers another fetch with the same inputs', async () => {
    fetchDiary.mockResolvedValue(samplePayload);
    const { result } = renderHook(() =>
      useDiary({ ownerUserId: '42', viewerUserId: '42', date: '2026-06-05' }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.refresh());
    await waitFor(() => expect(fetchDiary).toHaveBeenCalledTimes(2));
  });
});

describe('useDiary — input + error handling', () => {
  it('does NOT fire a request when ownerUserId is missing', async () => {
    const { result } = renderHook(() =>
      useDiary({ ownerUserId: null, viewerUserId: '42', date: '2026-06-05' }),
    );
    // Microtask flush — let the effect run.
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetchDiary).not.toHaveBeenCalled();
    expect(result.current.data).toBeNull();
  });

  it('does NOT fire a request when viewerUserId is missing', async () => {
    const { result } = renderHook(() =>
      useDiary({ ownerUserId: '42', viewerUserId: '', date: '2026-06-05' }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetchDiary).not.toHaveBeenCalled();
  });

  it('surfaces an Invalid date error for a bad string', async () => {
    const { result } = renderHook(() =>
      useDiary({ ownerUserId: '42', viewerUserId: '42', date: 'not-a-date' }),
    );
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error.message).toMatch(/Invalid date/);
    expect(fetchDiary).not.toHaveBeenCalled();
  });

  it('captures HTTP error status and message', async () => {
    const httpErr = new Error('boom');
    httpErr.response = { status: 403, data: { message: 'forbidden' } };
    fetchDiary.mockRejectedValueOnce(httpErr);
    const { result } = renderHook(() =>
      useDiary({ ownerUserId: '42', viewerUserId: '42', date: '2026-06-05' }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toEqual({ status: 403, message: 'forbidden' });
    expect(result.current.data).toBeNull();
  });

  it('ignores AbortError silently (component unmounted mid-request)', async () => {
    const abortErr = new Error('aborted');
    abortErr.name = 'AbortError';
    fetchDiary.mockRejectedValueOnce(abortErr);
    const { result } = renderHook(() =>
      useDiary({ ownerUserId: '42', viewerUserId: '42', date: '2026-06-05' }),
    );
    // The fetch ran; the hook should NOT surface the abort as an error.
    await waitFor(() => expect(fetchDiary).toHaveBeenCalled());
    // loading stays true because abort short-circuited the success path.
    // What we care about: error stays null (no spurious user-facing error).
    expect(result.current.error).toBeNull();
  });
});

describe('toYmd', () => {
  it('passes through valid YYYY-MM-DD strings', () => {
    expect(toYmd('2026-06-05')).toBe('2026-06-05');
  });

  it('returns null for invalid strings', () => {
    expect(toYmd('06/05/2026')).toBeNull();
    expect(toYmd('2026-6-5')).toBeNull();
  });

  it('returns null for invalid Date', () => {
    expect(toYmd(new Date('not a date'))).toBeNull();
    expect(toYmd(null)).toBeNull();
    expect(toYmd(undefined)).toBeNull();
  });

  it('uses IST when converting a Date — late-evening UTC does NOT shift the day', () => {
    // 2026-06-05T19:00:00Z = 2026-06-06T00:30:00 IST → "2026-06-06"
    expect(toYmd(new Date('2026-06-05T19:00:00Z'))).toBe('2026-06-06');
    // 2026-06-05T17:00:00Z = 2026-06-05T22:30:00 IST → "2026-06-05"
    expect(toYmd(new Date('2026-06-05T17:00:00Z'))).toBe('2026-06-05');
  });
});
