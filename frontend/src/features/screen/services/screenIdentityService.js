/**
 * screenIdentityService.js — pure helpers + IO for the screen slice.
 * Owns the multi-source DB userId resolver and a tiny date helper.
 */

/** YYYY-MM-DD for the local timezone. */
export function toDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Resolve the DB userId via prop → localStorage → /api/user/lookup, with a
 * 15s retry window. Returns a `stop()` cleanup function.
 *
 * @param {{ userId?: number, onResolved: (id: number) => void }} args
 */
export function resolveDbUserId({ userId, onResolved }) {
  let cancelled = false;
  let interval = null;
  let timeout = null;
  const stop = () => {
    cancelled = true;
    if (interval) clearInterval(interval);
    if (timeout) clearTimeout(timeout);
  };

  const tryOnce = async () => {
    if (cancelled) return false;
    if (userId) { onResolved(userId); return true; }
    const stored = localStorage.getItem('dbUserId');
    if (stored) { onResolved(Number(stored)); return true; }
    const email = localStorage.getItem('userEmail');
    if (!email) return false;
    try {
      const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;
      const res = await fetch(`${apiBaseUrl}/api/user/lookup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data?.success && data.userId) {
        localStorage.setItem('dbUserId', String(data.userId));
        if (!cancelled) onResolved(data.userId);
        return true;
      }
    } catch (e) {
      // eslint-disable-next-line no-console // FSM / lifecycle code — must reach crash reporters before logger is ready // FSM/lifecycle code must reach crash reporters before logger is ready
      console.warn('[ScreenTimeCard] userId fallback failed:', e.message);
    }
    return false;
  };

  tryOnce().then((resolved) => {
    if (resolved || cancelled) return;
    interval = setInterval(() => {
      tryOnce().then((ok) => { if (ok && interval) { clearInterval(interval); interval = null; } });
    }, 1000);
    timeout = setTimeout(() => { if (interval) clearInterval(interval); }, 15000);
  });

  return stop;
}
