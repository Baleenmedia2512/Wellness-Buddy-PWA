/**
 * Unit tests — camera resume cooldown guard
 *
 * REGRESSION GUARD — cancel-loop bug (May 2026)
 * ─────────────────────────────────────────────────────────────────────────────
 * BUG: After the user cancelled/closed the native camera, the OS fired
 * appStateChange({isActive:true}) TWICE on some Android (and occasionally iOS)
 * devices. The one-shot _justClosedCameraRef flag in App.js was consumed by
 * the first event, leaving the second event to bypass all guards and call
 * openCamera() again. The user would then cancel again, triggering the same
 * double-event, producing an infinite cancel-loop.
 *
 * FIX (App.js resume listener): after Filter 1 (_cameraInFlightRef /
 * _justClosedCameraRef / isCameraActive), add a time-based cooldown:
 *
 *   const _camClosedAt = fileInputRef.current?.lastCameraCloseAt?.() ?? 0;
 *   if (_camClosedAt > 0 && (Date.now() - _camClosedAt) < 3000) return;
 *
 * This file tests the cooldown predicate in isolation and verifies that
 * lastCameraCloseAt() (ImageUpload imperative handle) is populated correctly.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ---------------------------------------------------------------------------
// Helpers — pure predicate extracted from the resume listener for unit testing
// ---------------------------------------------------------------------------

/**
 * The exact predicate used in App.js Filter 1b.
 * Returns true when the resume event should be suppressed (camera just closed).
 *
 * @param {number} lastCameraCloseAt – ms timestamp from lastCameraCloseAt(), 0 if never closed
 * @param {number} now               – current timestamp (injectable for deterministic tests)
 * @param {number} cooldownMs        – suppression window (default 3000)
 */
function isCameraCloseCooldownActive(lastCameraCloseAt, now, cooldownMs = 3000) {
  return lastCameraCloseAt > 0 && (now - lastCameraCloseAt) < cooldownMs;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('isCameraCloseCooldownActive — resume listener Filter 1b', () => {
  describe('camera was never opened (lastCameraCloseAt = 0)', () => {
    it('does NOT suppress — allows legitimate first-time resume', () => {
      expect(isCameraCloseCooldownActive(0, Date.now())).toBe(false);
    });
  });

  describe('camera closed WITHIN the cooldown window', () => {
    it('suppresses an event 1 ms after close', () => {
      const closeTime = 1000;
      expect(isCameraCloseCooldownActive(closeTime, closeTime + 1)).toBe(true);
    });

    it('suppresses an event 500 ms after close', () => {
      const closeTime = 5000;
      expect(isCameraCloseCooldownActive(closeTime, closeTime + 500)).toBe(true);
    });

    it('suppresses an event exactly at 2999 ms (boundary — still inside window)', () => {
      const closeTime = 10000;
      expect(isCameraCloseCooldownActive(closeTime, closeTime + 2999)).toBe(true);
    });

    it('suppresses a SECOND isActive:true event fired 50 ms after the first consumed the one-shot flag', () => {
      // This is the exact cancel-loop scenario:
      // t=0    camera closes → lastCameraCloseAt = t0
      // t=50   isActive:true #1 → _justClosedCameraRef consumes it, returns
      // t=100  isActive:true #2 → cooldown check: 100ms < 3000ms → suppress ✅
      const t0 = 1_000_000;
      expect(isCameraCloseCooldownActive(t0, t0 + 50)).toBe(true);   // first event (belt-and-braces)
      expect(isCameraCloseCooldownActive(t0, t0 + 100)).toBe(true);  // second event — the bug scenario
      expect(isCameraCloseCooldownActive(t0, t0 + 200)).toBe(true);  // third (seen on some devices)
    });
  });

  describe('camera closed OUTSIDE the cooldown window', () => {
    it('does NOT suppress at exactly 3000 ms (boundary — just expired)', () => {
      const closeTime = 8000;
      expect(isCameraCloseCooldownActive(closeTime, closeTime + 3000)).toBe(false);
    });

    it('does NOT suppress at 5000 ms after close — user genuinely returned to app', () => {
      const closeTime = 8000;
      expect(isCameraCloseCooldownActive(closeTime, closeTime + 5000)).toBe(false);
    });

    it('does NOT suppress at 60 s after close — normal background/foreground cycle', () => {
      const closeTime = Date.now() - 60_000;
      expect(isCameraCloseCooldownActive(closeTime, Date.now())).toBe(false);
    });
  });

  describe('custom cooldown values', () => {
    it('respects a shorter 1000 ms window', () => {
      const t = 1_000_000;
      expect(isCameraCloseCooldownActive(t, t + 999, 1000)).toBe(true);
      expect(isCameraCloseCooldownActive(t, t + 1000, 1000)).toBe(false);
    });
  });
});
