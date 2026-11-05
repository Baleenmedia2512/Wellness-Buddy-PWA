/**
 * One free report-detail trial per member. StartedAt is UTC.
 * The table is created on first use, matching premium_orders_table.
 */
import { getPrisma } from '../../../shared/lib/prisma.js';
import logger from '../../../shared/lib/logger.js';

const CREATE_TABLE_SQL = `CREATE TABLE IF NOT EXISTS report_trials_table (
  UserId    BIGINT   NOT NULL,
  StartedAt DATETIME NOT NULL,
  CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (UserId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;

let ensurePromise = null;

async function ensureTable() {
  if (!ensurePromise) {
    ensurePromise = getPrisma()
      .$executeRawUnsafe(CREATE_TABLE_SQL)
      .catch((error) => {
        ensurePromise = null;
        logger.warn('report_trials_table could not be prepared', {
          message: error?.message || String(error),
        });
        throw error;
      });
  }
  return ensurePromise;
}

/**
 * @param {number} userId
 * @returns {Promise<Date|string|null>}
 */
export async function findReportTrialStart(userId) {
  await ensureTable();
  const rows = await getPrisma().$queryRawUnsafe(
    `SELECT StartedAt FROM report_trials_table WHERE UserId = ? LIMIT 1`,
    Number(userId),
  );
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return rows[0].StartedAt ?? rows[0].startedAt ?? null;
}

/**
 * Insert the start once. A second call keeps the original StartedAt.
 * @param {number} userId
 * @returns {Promise<Date|string|null>}
 */
export async function insertReportTrialStart(userId) {
  await ensureTable();
  await getPrisma().$executeRawUnsafe(
    `INSERT INTO report_trials_table (UserId, StartedAt)
     VALUES (?, UTC_TIMESTAMP())
     ON DUPLICATE KEY UPDATE UserId = UserId`,
    Number(userId),
  );
  return findReportTrialStart(userId);
}
