/**
 * backend/shared/lib/logger.js
 * ---------------------------------------------------------------------------
 * Shared structured logger for all backend features and API routes.
 *
 * Replaces bare console.log calls per claude.md §1.2.
 *
 * Usage:
 *   import logger from '../../shared/lib/logger.js';
 *   logger.info('Water log saved', { userId, ml });
 *   logger.debug('Query result', { rows: data.length });
 *   logger.warn('Unexpected state', { field, value });
 *   logger.error('DB failure', { err: err.message });
 * ---------------------------------------------------------------------------
 */

const IS_PROD = process.env.NODE_ENV === 'production';

function formatMsg(level, msg, meta) {
  const base = `[${level.toUpperCase()}] ${msg}`;
  return meta ? `${base} ${JSON.stringify(meta)}` : base;
}

const logger = {
  debug: IS_PROD
    ? () => {}
    : (msg, meta) => console.log(formatMsg('debug', msg, meta)),   // eslint-disable-line no-console -- this IS the logger

  info:  (msg, meta) => console.info(formatMsg('info', msg, meta)),   // eslint-disable-line no-console -- this IS the logger

  warn:  (msg, meta) => console.warn(formatMsg('warn', msg, meta)),   // eslint-disable-line no-console -- this IS the logger

  error: (msg, meta) => console.error(formatMsg('error', msg, meta)), // eslint-disable-line no-console -- this IS the logger
};

export default logger;
