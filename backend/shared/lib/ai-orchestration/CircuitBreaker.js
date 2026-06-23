/**
 * backend/shared/lib/ai-orchestration/CircuitBreaker.js
 * ---------------------------------------------------------------------------
 * Three-state circuit breaker for AI service calls.
 *
 * States:
 *   CLOSED    → normal operation; failure counter is tracked
 *   OPEN      → calls rejected immediately; service is assumed down
 *   HALF_OPEN → one probe call is allowed to test recovery
 *
 * Config:
 *   failureThreshold  consecutive failures before opening (default 5)
 *   successThreshold  consecutive successes in HALF_OPEN before closing (default 2)
 *   timeoutMs         time OPEN before probing recovery (default 60 s)
 *
 * Design note:
 *   Each AI service (e.g. "gemini") gets its own singleton breaker managed by
 *   the registry below. Business logic never instantiates breakers directly.
 * ---------------------------------------------------------------------------
 */

import logger from '../logger.js';

export const STATE = Object.freeze({
  CLOSED:    'CLOSED',
  OPEN:      'OPEN',
  HALF_OPEN: 'HALF_OPEN',
});

export class CircuitBreaker {
  /**
   * @param {object} opts
   * @param {string} [opts.name='default']
   * @param {number} [opts.failureThreshold=5]
   * @param {number} [opts.successThreshold=2]
   * @param {number} [opts.timeoutMs=60000]
   */
  constructor({
    name             = 'default',
    failureThreshold = 5,
    successThreshold = 2,
    timeoutMs        = 60_000,
  } = {}) {
    this.name             = name;
    this.failureThreshold = failureThreshold;
    this.successThreshold = successThreshold;
    this.timeoutMs        = timeoutMs;

    this._state        = STATE.CLOSED;
    this._failures     = 0;
    this._successes    = 0;
    this._lastOpenedAt = null;
  }

  get state() { return this._state; }

  /**
   * Execute fn through the breaker.
   * Throws immediately if OPEN and the timeout has not elapsed.
   * Throws with `err.code = 'CIRCUIT_OPEN'` when rejecting without calling fn.
   *
   * @template T
   * @param {() => Promise<T>} fn
   * @returns {Promise<T>}
   */
  async execute(fn) {
    if (this._state === STATE.OPEN) {
      if (Date.now() - this._lastOpenedAt >= this.timeoutMs) {
        this._transition(STATE.HALF_OPEN);
      } else {
        const err = new Error(`Circuit breaker OPEN for service: ${this.name}`);
        err.code  = 'CIRCUIT_OPEN';
        throw err;
      }
    }

    try {
      const result = await fn();
      this._onSuccess();
      return result;
    } catch (err) {
      this._onFailure(err);
      throw err;
    }
  }

  // ── Private ───────────────────────────────────────────────────────────────

  _onSuccess() {
    if (this._state === STATE.HALF_OPEN) {
      this._successes += 1;
      if (this._successes >= this.successThreshold) {
        this._transition(STATE.CLOSED);
      }
    } else {
      // Reset failure streak on any success in CLOSED state
      this._failures = 0;
    }
  }

  _onFailure(err) {
    this._successes = 0;
    this._failures += 1;
    logger.warn('circuit-breaker: failure recorded', {
      name:      this.name,
      failures:  this._failures,
      threshold: this.failureThreshold,
      state:     this._state,
      error:     err?.message ?? String(err),
    });

    if (this._state === STATE.HALF_OPEN || this._failures >= this.failureThreshold) {
      this._transition(STATE.OPEN);
    }
  }

  _transition(newState) {
    const prev = this._state;
    this._state = newState;

    if (newState === STATE.OPEN) {
      this._lastOpenedAt = Date.now();
      this._failures     = 0;
      this._successes    = 0;
    } else if (newState === STATE.CLOSED) {
      this._failures  = 0;
      this._successes = 0;
    } else if (newState === STATE.HALF_OPEN) {
      this._successes = 0;
    }

    logger.info('circuit-breaker: state transition', {
      name: this.name,
      from: prev,
      to:   newState,
    });
  }

  toJSON() {
    return {
      name:        this.name,
      state:       this._state,
      failures:    this._failures,
      lastOpenedAt: this._lastOpenedAt,
    };
  }
}

// ── Singleton registry ────────────────────────────────────────────────────────

/** @type {Map<string, CircuitBreaker>} */
const _registry = new Map();

/**
 * Return a named circuit breaker (creates one on first access).
 * @param {string} name
 * @param {object} [config]
 */
export function getBreaker(name, config = {}) {
  if (!_registry.has(name)) {
    _registry.set(name, new CircuitBreaker({ name, ...config }));
  }
  return _registry.get(name);
}

/**
 * Snapshot of all registered breaker states (for health/observability endpoints).
 * @returns {Record<string, object>}
 */
export function allBreakerStates() {
  const out = {};
  for (const [k, v] of _registry.entries()) {
    out[k] = v.toJSON();
  }
  return out;
}
