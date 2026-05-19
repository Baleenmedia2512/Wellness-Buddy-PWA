/**
 * frontend/src/features/quick-share/domain/daily-capture.rules.js
 * ---------------------------------------------------------------------------
 * Pure rules for tracking how many photos the current user has taken today.
 * No I/O. No imports of axios, fetch, localStorage, or React.
 * Callers inject raw storage values and a current IST date string.
 * ---------------------------------------------------------------------------
 */

export const DAILY_CAPTURE_KEY = 'qs_daily_captures';

/**
 * Parse raw storage value into a { date, count } state object.
 * Resets to zero when the stored date differs from todayIST.
 *
 * @param {string|null} raw   - raw value from storage (JSON or null)
 * @param {string} todayIST   - 'YYYY-MM-DD' in IST timezone
 * @returns {{ date: string, count: number }}
 */
export function parseDailyState(raw, todayIST) {
  if (!raw) return { date: todayIST, count: 0 };
  try {
    const parsed = JSON.parse(raw);
    if (parsed && parsed.date === todayIST && typeof parsed.count === 'number') {
      return { date: todayIST, count: parsed.count };
    }
  } catch {
    // malformed — reset
  }
  return { date: todayIST, count: 0 };
}

/**
 * Return a new state with count incremented by 1.
 * @param {{ date: string, count: number }} state
 * @returns {{ date: string, count: number }}
 */
export function incrementDailyState(state) {
  return { ...state, count: state.count + 1 };
}

/**
 * Serialize state for storage.
 * @param {{ date: string, count: number }} state
 * @returns {string}
 */
export function serializeDailyState(state) {
  return JSON.stringify(state);
}

/**
 * Return true if no photos have been taken today (count === 0).
 * @param {{ count: number }} state
 * @returns {boolean}
 */
export function isFirstCaptureOfDay(state) {
  return state.count === 0;
}

/**
 * Compute the current IST date string 'YYYY-MM-DD'.
 * Injected here as a pure helper so tests can freeze time via argument.
 *
 * @param {Date} [now=new Date()]
 * @returns {string}
 */
export function getTodayIST(now = new Date()) {
  const istMs = now.getTime() + 5.5 * 60 * 60 * 1000;
  return new Date(istMs).toISOString().substring(0, 10);
}
