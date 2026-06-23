/**
 * backend/shared/lib/ai-orchestration/ObservabilityTracer.js
 * ---------------------------------------------------------------------------
 * Trace context carrier for the AI analysis pipeline.
 *
 * Every pipeline run creates one TraceContext that flows through every layer.
 * It collects:
 *   traceId      — unique pipeline run ID (UUID v4)
 *   captureId    — DB capture identifier (correlation key)
 *   userId       — for audit trails
 *   stages       — per-stage { name, latencyMs, success, ... } records
 *   tokenUsage   — accumulated input/output token counts + estimated USD cost
 *   retryCount   — total retries across all stages
 *   modelVersion — Gemini model used (populated from first AI call)
 *
 * On completion, `complete()` emits one structured log entry containing the
 * full pipeline summary. This single entry is what a log aggregator (Datadog,
 * CloudWatch, etc.) indexes for dashboards and alerts.
 *
 * Usage:
 *   import { TraceContext } from './ObservabilityTracer.js';
 *   const trace = new TraceContext({ captureId, userId });
 *   // ... run pipeline stages ...
 *   const summary = trace.complete({ success: true, imageType: 'food' });
 * ---------------------------------------------------------------------------
 */

import { randomUUID } from 'crypto';
import logger from '../logger.js';

// Approximate pricing for gemini-2.5-flash-lite (USD per 1 M tokens).
// Update when Google publishes revised pricing.
const PRICING = Object.freeze({
  inputPerMToken:  0.075,
  outputPerMToken: 0.300,
});

export class TraceContext {
  /**
   * @param {object} [opts]
   * @param {string} [opts.captureId]  DB capture ID for log correlation.
   * @param {string} [opts.userId]     Caller user ID (will be stringified).
   * @param {string} [opts.traceId]    Override the auto-generated UUID (useful for replay).
   */
  constructor({ captureId = null, userId = null, traceId = null } = {}) {
    this.traceId      = traceId ?? randomUUID();
    this.captureId    = captureId   ? String(captureId)   : null;
    this.userId       = userId      ? String(userId)       : null;
    this.startTime    = Date.now();

    /** @type {Array<{ name: string, latencyMs: number, success: boolean }>} */
    this._stages = [];

    this._tokenUsage = {
      inputTokens:     0,
      outputTokens:    0,
      estimatedCostUsd: 0,
    };
    this._retryCount    = 0;
    this._modelVersion  = null;
  }

  // ── Mutation API ────────────────────────────────────────────────────────────

  /**
   * Append a completed stage record.
   * @param {object} opts
   * @param {string}  opts.name        Stage label (e.g. 'unified', 'enrichment').
   * @param {number}  opts.latencyMs   Wall-clock duration.
   * @param {boolean} opts.success     Did the stage complete without error?
   * @param {object}  [opts.extra]     Additional key/value pairs merged in.
   */
  addStage({ name, latencyMs, success, extra = {} }) {
    this._stages.push({
      name,
      latencyMs,
      success,
      ...extra,
      recordedAt: Date.now(),
    });
  }

  /**
   * Accumulate token counts from a Gemini response's usageMetadata.
   * Safe to call with partial data (fields default to 0).
   *
   * @param {object} opts
   * @param {number} [opts.inputTokens=0]
   * @param {number} [opts.outputTokens=0]
   * @param {string} [opts.model]  Populate modelVersion on first call.
   */
  addTokenUsage({ inputTokens = 0, outputTokens = 0, model = null } = {}) {
    this._tokenUsage.inputTokens  += inputTokens;
    this._tokenUsage.outputTokens += outputTokens;
    this._tokenUsage.estimatedCostUsd +=
      (inputTokens  / 1_000_000) * PRICING.inputPerMToken +
      (outputTokens / 1_000_000) * PRICING.outputPerMToken;

    if (model && !this._modelVersion) {
      this._modelVersion = model;
    }
  }

  /** Increment the total retry counter by one. */
  addRetry() {
    this._retryCount += 1;
  }

  // ── Terminal events ─────────────────────────────────────────────────────────

  /**
   * Emit the final pipeline summary log entry and return a summary object.
   *
   * @param {object} opts
   * @param {boolean} opts.success
   * @param {string}  [opts.imageType]   Resolved image type (e.g. 'food').
   * @param {string}  [opts.errorCode]   Error code if success=false.
   * @returns {{ traceId, totalLatencyMs, tokenUsage, retryCount, modelVersion }}
   */
  complete({ success, imageType = null, errorCode = null } = {}) {
    const totalLatencyMs = Date.now() - this.startTime;

    logger.info('ai.pipeline.complete', {
      traceId:      this.traceId,
      captureId:    this.captureId,
      userId:       this.userId,
      success,
      imageType:    imageType    ?? null,
      errorCode:    errorCode    ?? null,
      totalLatencyMs,
      stageCount:   this._stages.length,
      stages:       this._stages,
      tokenUsage:   this._tokenUsage,
      retryCount:   this._retryCount,
      modelVersion: this._modelVersion ?? 'unknown',
    });

    return {
      traceId:       this.traceId,
      totalLatencyMs,
      tokenUsage:    { ...this._tokenUsage },
      retryCount:    this._retryCount,
      modelVersion:  this._modelVersion,
    };
  }

  /**
   * Emit a structured error event (non-terminal — pipeline may continue).
   *
   * @param {object} opts
   * @param {string} opts.stage    Which stage raised the error.
   * @param {string} opts.message  Error message.
   * @param {string} [opts.code]   Error code.
   */
  error({ stage, message, code = null }) {
    logger.error('ai.pipeline.error', {
      traceId:   this.traceId,
      captureId: this.captureId,
      userId:    this.userId,
      stage,
      errorCode: code    ?? null,
      message,
    });
  }

  // ── Accessor ────────────────────────────────────────────────────────────────

  /** Minimal correlation context for passing into downstream calls. */
  toContext() {
    return {
      traceId:   this.traceId,
      captureId: this.captureId,
      userId:    this.userId,
    };
  }

  /** Current elapsed time without closing the trace. */
  elapsedMs() {
    return Date.now() - this.startTime;
  }
}
