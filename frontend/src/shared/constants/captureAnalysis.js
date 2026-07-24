/**
 * Timing constants for the camera capture → AI → save pipeline.
 * Keep in sync with orchestratorService.js (3 × ~40 s attempts + back-off).
 */

/** Worst-case Phase-1 AI budget (3 attempts + back-off), in seconds. */
export const ANALYSIS_ATTEMPT_BUDGET_SECS = 125;

/** Max wait for POST /api/background-analysis (save) before treating as failed. */
export const ANALYSIS_SAVE_TIMEOUT_MS = 60_000;

/** Matches backend STALE_PENDING_MS — pending rows older than this show Manual Log. */
export const STALE_PENDING_SECS = 15 * 60;
