/**
 * backend/shared/lib/gemini/retryPolicy.js
 * ---------------------------------------------------------------------------
 * Exponential-backoff retry wrapper for Gemini API calls.
 *
 * Retryable status codes: 429, 500, 502, 503, and network timeouts.
 * Maximum 3 attempts. Jitter added to avoid thundering-herd on 429s.
 *
 * Usage:
 *   import { withRetry } from '../../shared/lib/gemini/retryPolicy.js';
 *   const result = await withRetry(() => model.generateContent(parts), { label: 'nutrition' });
 * ---------------------------------------------------------------------------
 */

import logger from '../logger.js';

const RETRYABLE_CODES = new Set([429, 500, 502, 503]);
const MAX_ATTEMPTS    = 3;
const BASE_DELAY_MS   = 600; // 600 ms → 1.2 s → 2.4 s (+ jitter)

/**
 * Returns true when the thrown error should trigger a retry.
 * @param {unknown} err
 */
function isRetryable(err) {
  if (!err) return false;
  // Gemini SDK surfaces HTTP status on err.status
  if (err.status && RETRYABLE_CODES.has(Number(err.status))) return true;
  // Network-level timeouts / connection resets
  const msg = (err.message || '').toLowerCase();
  if (msg.includes('timeout') || msg.includes('econnreset') || msg.includes('econnrefused')) return true;
  return false;
}

/**
 * Jittered delay: full-jitter strategy (random in [0, delay]).
 * @param {number} attempt  0-based attempt index
 */
function delayMs(attempt) {
  const exponential = BASE_DELAY_MS * (2 ** attempt);
  return Math.floor(Math.random() * exponential);
}

/**
 * Execute `fn` with automatic retries on transient Gemini errors.
 *
 * @template T
 * @param {() => Promise<T>} fn         The async function to execute.
 * @param {{ label?: string }} [opts]   `label` is included in log entries.
 * @returns {Promise<T>}
 * @throws  The last error after all attempts are exhausted.
 */
export async function withRetry(fn, { label = 'gemini' } = {}) {
  let lastErr;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const t0 = Date.now();
    try {
      const result = await fn();
      const latencyMs = Date.now() - t0;
      if (attempt > 0) {
        logger.info(`gemini.retry: succeeded on attempt ${attempt + 1}`, { label, latencyMs, attempt });
      }
      return result;
    } catch (err) {
      lastErr = err;
      const latencyMs = Date.now() - t0;
      const retryable  = isRetryable(err);
      logger.warn('gemini.retry: attempt failed', {
        label,
        attempt: attempt + 1,
        maxAttempts: MAX_ATTEMPTS,
        latencyMs,
        retryable,
        status: err.status ?? null,
        message: err.message,
      });

      if (!retryable || attempt === MAX_ATTEMPTS - 1) break;

      const wait = delayMs(attempt);
      logger.info('gemini.retry: waiting before retry', { label, waitMs: wait, nextAttempt: attempt + 2 });
      await new Promise((res) => setTimeout(res, wait)); // eslint-disable-line no-promise-executor-return
    }
  }
  throw lastErr;
}
