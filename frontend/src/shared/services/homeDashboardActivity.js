/**
 * Home / Wellness Score activity watermark (“async activity log”).
 *
 * There is no separate backend async-log table in this codebase. Dashboard-
 * affecting work already calls `NutritionRefreshContext.triggerRefresh({ source })`
 * after food/weight/education/camera/profile (etc.) mutations. That call also
 * records a monotonic activity-log ID here.
 *
 * Refresh decision when Home or Wellness Score mounts / becomes active again:
 *   - If latestActivityLogId === lastProcessed*ActivityLogId → skip refetch
 *   - If a newer ID exists → refetch, then mark that surface processed
 *
 * Home and Wellness Score keep separate lastProcessed IDs + snapshots so each
 * can skip independently while sharing the same activity watermark.
 *
 * Prefer keeping Home mounted (App.js overlay) so scroll/state survive; this
 * module is the defense-in-depth when a remount still happens.
 */

let latestActivityLogId = 0;
/** @type {number|null} null = Home has never successfully processed a load */
let lastProcessedActivityLogId = null;
let lastSource = 'init';

/** In-memory snapshot so a remount can paint without a loading spinner. */
let homeSnapshot = null;

/**
 * Wellness Score sheet — separate processed watermark + snapshot so Home and
 * Wellness Score can skip independently while sharing the same activity log.
 * @type {number|null}
 */
let lastProcessedWellnessScoreActivityLogId = null;
/** @type {object|null} */
let wellnessScoreSnapshot = null;

/**
 * Record that a dashboard-affecting activity completed.
 * @param {string} [source]
 * @returns {number} new latest activity log id
 */
export function recordDashboardActivity(source = 'unknown') {
  latestActivityLogId += 1;
  lastSource = source;
  return latestActivityLogId;
}

export function getLatestActivityLogId() {
  return latestActivityLogId;
}

export function getLastProcessedActivityLogId() {
  return lastProcessedActivityLogId;
}

/**
 * True when Home should reload dashboard APIs.
 * First visit (never processed) always refreshes.
 */
export function shouldRefreshHomeDashboard() {
  if (lastProcessedActivityLogId == null) return true;
  return latestActivityLogId !== lastProcessedActivityLogId;
}

/**
 * Mark the current (or provided) activity log as applied to Home UI.
 * @param {number} [logId]
 */
export function markHomeDashboardProcessed(logId = latestActivityLogId) {
  lastProcessedActivityLogId = logId;
}

/**
 * @returns {{ latestActivityLogId: number, lastProcessedActivityLogId: number|null, lastSource: string }}
 */
export function getActivityLogDebug() {
  return { latestActivityLogId, lastProcessedActivityLogId, lastSource };
}

/**
 * @param {object|null} snapshot
 */
export function setHomeDashboardSnapshot(snapshot) {
  homeSnapshot = snapshot;
}

export function getHomeDashboardSnapshot() {
  return homeSnapshot;
}

export function clearHomeDashboardSnapshot() {
  homeSnapshot = null;
  lastProcessedActivityLogId = null;
  wellnessScoreSnapshot = null;
  lastProcessedWellnessScoreActivityLogId = null;
}

/**
 * True when Wellness Score sheet should reload from the API.
 * First open (never processed) always refreshes.
 */
export function shouldRefreshWellnessScore() {
  if (lastProcessedWellnessScoreActivityLogId == null) return true;
  return latestActivityLogId !== lastProcessedWellnessScoreActivityLogId;
}

/**
 * @param {number} [logId]
 */
export function markWellnessScoreProcessed(logId = latestActivityLogId) {
  lastProcessedWellnessScoreActivityLogId = logId;
}

export function getLastProcessedWellnessScoreActivityLogId() {
  return lastProcessedWellnessScoreActivityLogId;
}

/**
 * @param {object|null} snapshot
 */
export function setWellnessScoreSnapshot(snapshot) {
  wellnessScoreSnapshot = snapshot;
}

export function getWellnessScoreSnapshot() {
  return wellnessScoreSnapshot;
}

export function clearWellnessScoreSnapshot() {
  wellnessScoreSnapshot = null;
  lastProcessedWellnessScoreActivityLogId = null;
}

/**
 * Drop the painted sheet snapshot without resetting the processed watermark.
 * Call when a newer activity is recorded so remounts cannot restore a stale total.
 */
export function invalidateWellnessScoreSnapshot() {
  wellnessScoreSnapshot = null;
}

/** @internal test helper */
export function __resetHomeDashboardActivityForTests() {
  latestActivityLogId = 0;
  lastProcessedActivityLogId = null;
  lastSource = 'init';
  homeSnapshot = null;
  lastProcessedWellnessScoreActivityLogId = null;
  wellnessScoreSnapshot = null;
}
