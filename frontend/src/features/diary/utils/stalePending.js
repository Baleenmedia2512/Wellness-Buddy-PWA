/**
 * Stale pending-capture policy for the diary feed (frontend mirror).
 * Keep in sync with:
 *   backend/features/background-analysis/domain/stale-pending-captures.js
 *
 * Budget = 3 Phase-1 attempts (orchestratorService.js) + 15 s grace → Manual Log.
 */

/** Must match MAX_ATTEMPTS in orchestratorService.js */
export const PHASE1_MAX_ATTEMPTS = 3;
/** Must match REQUEST_TIMEOUT_MS in orchestratorService.js */
export const PHASE1_REQUEST_TIMEOUT_MS = 40_000;
/** Must match RETRY_DELAY_MS in orchestratorService.js (×1 then ×2 between retries) */
export const PHASE1_RETRY_DELAYS_MS = 1_500 + 3_000;
/** Grace after the last attempt before surfacing Manual Log */
export const MANUAL_MODE_GRACE_MS = 15_000;

/** 3 × 40 s + 4.5 s back-off + 15 s grace ≈ 139.5 s */
export const STALE_PENDING_MS =
  PHASE1_MAX_ATTEMPTS * PHASE1_REQUEST_TIMEOUT_MS
  + PHASE1_RETRY_DELAYS_MS
  + MANUAL_MODE_GRACE_MS;

/**
 * @param {string|null|undefined} capturedAtIso
 * @param {number} [nowMs]
 * @returns {boolean}
 */
export function isStalePendingAnalysis(capturedAtIso, nowMs = Date.now()) {
  if (!capturedAtIso) return false;
  const t = new Date(capturedAtIso).getTime();
  if (!Number.isFinite(t)) return false;
  return nowMs - t >= STALE_PENDING_MS;
}

/**
 * Pending capture meta scoped to the diary owner being viewed.
 * Prevents a coach's in-flight upload from appearing in a member's diary.
 *
 * @param {Map<string, object>|null|undefined} pendingCaptureMeta
 * @param {string|number|null|undefined} ownerUserId
 * @param {string|number|null|undefined} viewerUserId
 * @returns {Map<string, object>|null}
 */
export function filterPendingCaptureMetaForOwner(
  pendingCaptureMeta,
  ownerUserId,
  viewerUserId,
) {
  if (!pendingCaptureMeta || pendingCaptureMeta.size === 0) return null;

  const ownerStr = ownerUserId != null && ownerUserId !== '' ? String(ownerUserId) : '';
  const viewerStr = viewerUserId != null && viewerUserId !== '' ? String(viewerUserId) : '';
  const filtered = new Map();

  pendingCaptureMeta.forEach((meta, captureId) => {
    const metaOwner =
      meta.ownerUserId != null && meta.ownerUserId !== ''
        ? String(meta.ownerUserId)
        : null;

    if (metaOwner != null) {
      if (metaOwner !== ownerStr) return;
    } else if (ownerStr !== viewerStr) {
      // Legacy rows without ownerUserId — only show on the uploader's own diary.
      return;
    }

    filtered.set(captureId, meta);
  });

  return filtered.size > 0 ? filtered : null;
}
