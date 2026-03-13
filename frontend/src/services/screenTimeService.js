/**
 * Screen Time Service
 *
 * Tracks the time a user spends inside the app.
 * - Call `startSession(userId)` when the app becomes active / foreground.
 * - Call `endSession()` when the app goes to background or is closed.
 * - The service records the start timestamp, computes the duration on end,
 *   and POSTs it to the backend.
 */

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

class ScreenTimeService {
  constructor() {
    this._userId = null;
    this._startTime = null; // ISO string
    this._active = false;
  }

  /** Begin a session for the given userId. */
  startSession(userId) {
    if (!userId) return;
    if (this._active) {
      // Already tracking – ignore double-starts
      return;
    }
    this._userId = userId;
    this._startTime = new Date().toISOString();
    this._active = true;
    console.log('[ScreenTime] ▶ Session started', this._startTime);
  }

  /**
   * End the current session and persist it to the backend.
   * Safe to call even when no session is active.
   */
  async endSession() {
    if (!this._active || !this._userId || !this._startTime) return;

    const endTime = new Date().toISOString();
    const durationSeconds = Math.round(
      (new Date(endTime) - new Date(this._startTime)) / 1000
    );

    // Reset state before the async call so a parallel trigger can't dupe-fire
    const payload = {
      userId: this._userId,
      startTime: this._startTime,
      endTime,
      durationSeconds
    };

    this._active = false;
    this._startTime = null;

    console.log(`[ScreenTime] ⏹ Session ended – ${durationSeconds}s`);

    try {
      await fetch(`${API_BASE_URL}/api/save-app-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        // Use keepalive so the request survives app backgrounding on mobile
        keepalive: true
      });
    } catch (err) {
      // Non-fatal: silently log; data loss is acceptable here
      console.warn('[ScreenTime] ⚠ Failed to save session:', err.message);
    }
  }

  /** Returns true when a session is actively being timed. */
  get isActive() {
    return this._active;
  }
}

// Singleton instance shared across the app
export const screenTimeService = new ScreenTimeService();
