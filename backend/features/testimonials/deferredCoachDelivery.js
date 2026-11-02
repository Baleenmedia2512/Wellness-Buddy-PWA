/**
 * Run share-card / coach-email work after the HTTP response is free to return.
 * OTP UI should not wait on Gmail SMTP or card composition.
 */
import { waitUntil } from '@vercel/functions';
import logger from '../../shared/lib/logger.js';

/**
 * @param {string} label
 * @param {() => Promise<unknown>} task
 */
export function scheduleDeferredCoachDelivery(label, task) {
  const run = Promise.resolve()
    .then(() => task())
    .catch((err) => {
      logger.warn(`[testimonials] Deferred ${label} failed`, {
        message: err?.message || String(err),
      });
    });

  try {
    waitUntil(run);
  } catch {
    // Local / non-Vercel request context — still fire-and-forget.
    void run;
  }
}
