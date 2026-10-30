/**
 * Wallet-only: send the cash OTP email after the HTTP response returns.
 * Does not change login, Community ID, or other mail.
 */
import { waitUntil } from '@vercel/functions';
import logger from '../../../shared/lib/logger.js';

/**
 * @param {() => Promise<unknown>} task
 */
export function scheduleWalletOtpMail(task) {
  const run = Promise.resolve()
    .then(() => task())
    .catch((err) => {
      logger.warn('[wallet] background OTP email failed', {
        message: err?.message || String(err),
      });
    });

  try {
    waitUntil(run);
  } catch {
    void run;
  }
}
