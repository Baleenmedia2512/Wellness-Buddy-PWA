/**
 * backend/shared/lib/ai-orchestration/AnalysisStatus.js
 * ---------------------------------------------------------------------------
 * Workflow states for the AI analysis pipeline.
 *
 * These are PROCESSING states — distinct from image classification types
 * (food / weight / education / smartwatch / other), which live in
 * backend/features/captures/domain/image-types.js.
 *
 * State machine:
 *
 *   PENDING
 *     │  capture registered, Gemini not yet called
 *     ▼
 *   ANALYZING
 *     │  Gemini in-flight (single unified call)
 *     ▼
 *   FAST_COMPLETE          ← set ONLY after data row persisted to DB
 *     │  fast macros available; enrichment job enqueued
 *     ▼
 *   ENRICHING
 *     │  background worker computing micronutrients
 *     ▼
 *   COMPLETE               ← all 26 nutrition fields available
 *
 * FAILED is reachable from any state on unrecoverable error.
 *
 * Rules (non-negotiable per spec):
 *   - FAST_COMPLETE MUST NOT be set before the corresponding domain row
 *     (food / weight / education / smartwatch) exists in the DB.
 *   - FAILED must include a structured log with traceId, captureId, stage,
 *     and error details — never silently returned.
 *   - ENRICHING is only set for food captures that have a queued background job.
 *   - Non-food captures (weight / education / smartwatch / other) transition
 *     directly PENDING → ANALYZING → FAST_COMPLETE (no enrichment stage).
 * ---------------------------------------------------------------------------
 */

export const ANALYSIS_STATUS = Object.freeze({
  /** Initial state: capture registered, Gemini not yet called. */
  PENDING:        'PENDING',
  /** Gemini unified call is in-flight. */
  ANALYZING:      'ANALYZING',
  /**
   * Fast analysis complete AND the corresponding domain row has been persisted
   * to the DB. Safe to show nutrition preview to the user.
   */
  FAST_COMPLETE:  'FAST_COMPLETE',
  /** Background enrichment job enqueued and processing. */
  ENRICHING:      'ENRICHING',
  /** All fields complete (macros + micronutrients / enrichment). */
  COMPLETE:       'COMPLETE',
  /** Unrecoverable failure at any stage. Details in structured log. */
  FAILED:         'FAILED',
});

/** States that are terminal (no further transitions expected). */
export const TERMINAL_ANALYSIS_STATES = Object.freeze([
  ANALYSIS_STATUS.COMPLETE,
  ANALYSIS_STATUS.FAILED,
]);

/** States where the capture is still being processed. */
export const IN_PROGRESS_ANALYSIS_STATES = Object.freeze([
  ANALYSIS_STATUS.PENDING,
  ANALYSIS_STATUS.ANALYZING,
  ANALYSIS_STATUS.ENRICHING,
]);
