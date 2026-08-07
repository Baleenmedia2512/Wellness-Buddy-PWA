/**
 * Lightweight timing marks for Activity Report endpoints.
 * Logs structured fields for ops dashboards (no PII).
 */
import logger from '../../../shared/lib/logger.js';

/**
 * @param {string} label
 * @returns {{
 *   mark: (name: string) => void,
 *   done: (extra?: Record<string, unknown>) => void,
 *   elapsedMs: () => number,
 * }}
 */
export function createActivityReportPerf(label) {
  const startedAt = Date.now();
  /** @type {Array<{ name: string, ms: number }>} */
  const marks = [];

  return {
    mark(name) {
      marks.push({ name, ms: Date.now() - startedAt });
    },
    elapsedMs() {
      return Date.now() - startedAt;
    },
    done(extra = {}) {
      const totalMs = Date.now() - startedAt;
      logger.info('activity-report.perf', {
        label,
        totalMs,
        marks,
        ...extra,
      });
    },
  };
}

/**
 * Approximate UTF-8 byte size of a JSON-serializable value (response body).
 * @param {unknown} value
 * @returns {number}
 */
export function approxJsonBytes(value) {
  try {
    return Buffer.byteLength(JSON.stringify(value), 'utf8');
  } catch {
    return 0;
  }
}
