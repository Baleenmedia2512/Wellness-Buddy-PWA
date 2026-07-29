/**
 * Stale pending-capture policy for the diary feed.
 *
 * Captures that remain ImageType='pending' longer than STALE_PENDING_MS are
 * treated as abandoned (app killed mid-analysis, hung save, etc.) and should
 * be promoted to 'unknown' so the feed shows Manual Log instead of
 * "Analyzing…" indefinitely.
 *
 * Budget mirrors frontend Phase-1 orchestrator: 3 attempts + 15 s grace.
 */

/** Must stay aligned with orchestratorService.js MAX_ATTEMPTS */
export const PHASE1_MAX_ATTEMPTS = 3;
/** Must stay aligned with orchestratorService.js REQUEST_TIMEOUT_MS */
export const PHASE1_REQUEST_TIMEOUT_MS = 40_000;
/** Back-off between retries: 1.5 s + 3 s */
export const PHASE1_RETRY_DELAYS_MS = 1_500 + 3_000;
/** Grace after the last attempt before Manual Log */
export const MANUAL_MODE_GRACE_MS = 15_000;

/** 3 × 40 s + 4.5 s back-off + 15 s grace ≈ 139.5 s */
export const STALE_PENDING_MS =
  PHASE1_MAX_ATTEMPTS * PHASE1_REQUEST_TIMEOUT_MS
  + PHASE1_RETRY_DELAYS_MS
  + MANUAL_MODE_GRACE_MS;

/**
 * @param {string|null|undefined} capturedAtIso  UTC ISO timestamp
 * @param {number} [nowMs]
 * @returns {boolean}
 */
export function isStalePendingCapture(capturedAtIso, nowMs = Date.now()) {
  if (!capturedAtIso) return false;
  const t = new Date(capturedAtIso).getTime();
  if (!Number.isFinite(t)) return false;
  return nowMs - t >= STALE_PENDING_MS;
}

/**
 * Diary feed projection for a pending capture row.
 *
 * @param {string|null|undefined} capturedAtIso
 * @param {number} [nowMs]
 * @returns {{ stale: boolean, isPendingAnalysis: boolean, displayImageType: 'pending'|'unknown' }}
 */
export function resolvePendingCaptureDisplay(capturedAtIso, nowMs = Date.now()) {
  const stale = isStalePendingCapture(capturedAtIso, nowMs);
  return {
    stale,
    isPendingAnalysis: !stale,
    displayImageType: stale ? 'unknown' : 'pending',
  };
}
