/**
 * Stale pending-capture policy for the diary feed.
 *
 * Captures that remain ImageType='pending' longer than STALE_PENDING_MS are
 * treated as abandoned (app killed mid-analysis, hung save, etc.) and should
 * be promoted to 'unknown' so the feed shows Manual Log instead of
 * "Analyzing…" indefinitely.
 */

/** 15 minutes — well beyond the ~125 s frontend AI + save budget. */
export const STALE_PENDING_MS = 15 * 60 * 1_000;

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
