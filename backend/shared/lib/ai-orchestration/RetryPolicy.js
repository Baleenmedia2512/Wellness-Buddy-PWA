/**
 * backend/shared/lib/ai-orchestration/RetryPolicy.js
 * ---------------------------------------------------------------------------
 * Enterprise retry policy for AI service calls.
 *
 * Features vs legacy retryPolicy.js:
 *   ✓ Per-attempt hard timeout (prevents runaway Gemini calls)
 *   ✓ Circuit breaker integration (fast-fail when service is down)
 *   ✓ Respects Retry-After header on 429 responses
 *   ✓ Full-jitter exponential backoff (avoids thundering herd)
 *   ✓ Structured observability events on every attempt
 *   ✓ Returns attempt count + total latency for tracing
 *
 * Usage:
 *   import { withEnterpriseRetry, getBreakerStates } from './RetryPolicy.js';
 *   const { result, attempts } = await withEnterpriseRetry(
 *     () => model.generateContent(parts),
 *     { label: 'unified', service: 'gemini' }
 *   );
 * ---------------------------------------------------------------------------
 */

import logger from '../logger.js';
import { getBreaker, allBreakerStates } from './CircuitBreaker.js';

// ── Constants ─────────────────────────────────────────────────────────────────

/** HTTP status codes that warrant a retry (transient server-side errors). */
const RETRYABLE_CODES = new Set([429, 500, 502, 503]);

const DEFAULT_MAX_ATTEMPTS  = 3;
const DEFAULT_BASE_DELAY_MS = 600;   // 600 ms → 1.2 s → 2.4 s + jitter
const DEFAULT_MAX_DELAY_MS  = 15_000; // cap single backoff at 15 s
/**
 * Hard per-attempt timeout (model call only; telemetry is outside this budget).
 * Gemini p95 ≈ 43s; Vercel orchestrate maxDuration = 60s.
 * Override with AI_CALL_TIMEOUT_MS when needed (e.g. local debugging).
 */
export const DEFAULT_TIMEOUT_MS = (() => {
  const fromEnv = Number.parseInt(process.env.AI_CALL_TIMEOUT_MS ?? '', 10);
  if (Number.isFinite(fromEnv) && fromEnv >= 10_000 && fromEnv <= 120_000) {
    return fromEnv;
  }
  return 58_000;
})();

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Full-jitter exponential backoff.
 * Result is in [0, min(maxMs, baseMs * 2^attempt)].
 */
function jitteredDelayMs(attempt, baseMs, maxMs) {
  const cap = Math.min(maxMs, baseMs * (2 ** attempt));
  return Math.floor(Math.random() * cap);
}

/**
 * Extract Retry-After value (converted to ms) from a 429 error, if present.
 * Gemini surfaces this on err.headers or err.retryAfter.
 * Returns null when not available.
 */
function retryAfterMs(err) {
  const raw = err?.headers?.['retry-after'] ?? err?.retryAfter ?? null;
  if (raw === null) return null;
  const secs = Number(raw);
  return Number.isFinite(secs) ? secs * 1_000 : null;
}

/**
 * Returns true when the error is transient and the call should be retried.
 * CIRCUIT_OPEN is explicitly non-retryable: fail immediately.
 */
function isRetryable(err) {
  if (!err) return false;
  if (err.code === 'CIRCUIT_OPEN') return false;
  if (err.code === 'TIMEOUT') return true; // per-attempt timeout is retryable
  if (err.status != null && RETRYABLE_CODES.has(Number(err.status))) return true;
  const msg = (err.message ?? '').toLowerCase();
  return (
    msg.includes('timeout')     ||
    msg.includes('econnreset')  ||
    msg.includes('econnrefused')
  );
}

/**
 * Wrap a promise with a hard per-attempt timeout.
 * Rejects with `err.code = 'TIMEOUT'` only if the underlying promise has not
 * already settled. If Gemini resolves in the same tick as the timer, the
 * successful result wins (avoids discarding a just-finished model response).
 */
function withTimeout(promise, ms, label) {
  if (!ms || ms <= 0) return promise;

  return new Promise((resolve, reject) => {
    let settled = false;
    const pending = Promise.resolve(promise);

    const timerId = setTimeout(() => {
      if (settled) return;
      settled = true;
      // Keep the orphaned Gemini call from becoming an unhandledRejection.
      pending.catch(() => {});
      const err = new Error(`AI call timed out after ${ms} ms [${label}]`);
      err.code = 'TIMEOUT';
      reject(err);
    }, ms);

    pending.then(
      (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timerId);
        resolve(value);
      },
      (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timerId);
        reject(err);
      },
    );
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Execute `fn` with the enterprise retry policy.
 *
 * @template T
 * @param {() => Promise<T>} fn              The async function to execute.
 * @param {object} [opts]
 * @param {string} [opts.label='ai']         Human-readable label for logs.
 * @param {string} [opts.service='gemini']   Service name for circuit breaker.
 * @param {number} [opts.maxAttempts=3]
 * @param {number} [opts.baseDelayMs=600]
 * @param {number} [opts.maxDelayMs=15000]
 * @param {number} [opts.timeoutMs=55000]    Per-attempt hard timeout.
 * @param {boolean}[opts.useCircuitBreaker=true]
 * @returns {Promise<{ result: T, attempts: number, totalLatencyMs: number }>}
 * @throws The last error after all retry attempts are exhausted.
 */
export async function withEnterpriseRetry(fn, {
  label             = 'ai',
  service           = 'gemini',
  maxAttempts       = DEFAULT_MAX_ATTEMPTS,
  baseDelayMs       = DEFAULT_BASE_DELAY_MS,
  maxDelayMs        = DEFAULT_MAX_DELAY_MS,
  timeoutMs         = DEFAULT_TIMEOUT_MS,
  useCircuitBreaker = true,
} = {}) {
  const breaker       = useCircuitBreaker ? getBreaker(service) : null;
  const pipelineStart = Date.now();
  let lastErr;

  for (let i = 0; i < maxAttempts; i += 1) {
    const attemptStart = Date.now();

    try {
      // Wrap fn: timeout protection → circuit breaker → actual call
      const callFn = () => withTimeout(fn(), timeoutMs, label);
      const result = breaker ? await breaker.execute(callFn) : await callFn();

      if (i > 0) {
        logger.info('ai.retry: succeeded after retry', {
          label,
          attempt: i + 1,
          attemptLatencyMs: Date.now() - attemptStart,
        });
      }

      return {
        result,
        attempts:        i + 1,
        totalLatencyMs:  Date.now() - pipelineStart,
      };
    } catch (err) {
      lastErr = err;
      const retryable = isRetryable(err);

      logger.warn('ai.retry: attempt failed', {
        label,
        service,
        attempt:          i + 1,
        maxAttempts,
        attemptLatencyMs: Date.now() - attemptStart,
        retryable,
        errorCode:        err.code   ?? null,
        status:           err.status ?? null,
        message:          err.message,
      });

      // Non-retryable errors or final attempt → give up
      if (!retryable || i === maxAttempts - 1) break;

      // Choose delay: honour Retry-After on 429, else jittered backoff
      const delay = retryAfterMs(err) ?? jitteredDelayMs(i, baseDelayMs, maxDelayMs);
      logger.info('ai.retry: backing off', { label, delayMs: delay, nextAttempt: i + 2 });
      await new Promise(r => setTimeout(r, delay));  // eslint-disable-line no-promise-executor-return
    }
  }

  throw lastErr;
}

/**
 * Snapshot of all circuit breaker states.
 * Useful for /api/health or /api/ai/status endpoints.
 */
export { allBreakerStates as getBreakerStates };
