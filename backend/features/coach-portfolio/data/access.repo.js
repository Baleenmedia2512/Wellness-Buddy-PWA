/**
 * Coach portfolio paid access. Table is ensured on first use (same pattern as Premium).
 */
import { getPrisma } from '../../../shared/lib/prisma.js';
import logger from '../../../shared/lib/logger.js';
import { PORTFOLIO_STATUS } from '../domain/access.rules.js';

const CREATE_TABLE_SQL = `CREATE TABLE IF NOT EXISTS coach_portfolio_access_table (
  Id          BIGINT       NOT NULL AUTO_INCREMENT,
  UserId      BIGINT       NOT NULL,
  Status      VARCHAR(16)  NOT NULL DEFAULT 'not_paid',
  Source      VARCHAR(32)  NOT NULL DEFAULT 'admin',
  MarkedBy    BIGINT       NULL,
  MarkedAt    DATETIME     NULL,
  CreatedAt   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (Id),
  UNIQUE KEY uq_coach_portfolio_access_user (UserId),
  KEY idx_coach_portfolio_access_status (Status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;

let ensurePromise = null;

async function ensureTable() {
  if (!ensurePromise) {
    ensurePromise = getPrisma()
      .$executeRawUnsafe(CREATE_TABLE_SQL)
      .catch((error) => {
        ensurePromise = null;
        logger.warn('coach_portfolio_access_table could not be prepared', {
          message: error?.message || String(error),
        });
        throw error;
      });
  }
  return ensurePromise;
}

/**
 * @param {number} userId
 * @returns {Promise<{ userId: number, status: string, source: string|null, markedAt: Date|string|null }|null>}
 */
export async function findAccessByUserId(userId) {
  await ensureTable();
  const rows = await getPrisma().$queryRawUnsafe(
    `SELECT UserId AS userId, Status AS status, Source AS source, MarkedAt AS markedAt
     FROM coach_portfolio_access_table
     WHERE UserId = ?
     LIMIT 1`,
    Number(userId),
  );
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const row = rows[0];
  return {
    userId: Number(row.userId),
    status: String(row.status || PORTFOLIO_STATUS.NOT_PAID),
    source: row.source != null ? String(row.source) : null,
    markedAt: row.markedAt ?? null,
  };
}

/**
 * Upsert paid / not_paid for one coach.
 * @param {{ userId: number, status: string, source: string, markedBy: number }} input
 */
export async function upsertAccess({ userId, status, source, markedBy }) {
  await ensureTable();
  await getPrisma().$executeRawUnsafe(
    `INSERT INTO coach_portfolio_access_table (UserId, Status, Source, MarkedBy, MarkedAt)
     VALUES (?, ?, ?, ?, UTC_TIMESTAMP())
     ON DUPLICATE KEY UPDATE
       Status = VALUES(Status),
       Source = VALUES(Source),
       MarkedBy = VALUES(MarkedBy),
       MarkedAt = UTC_TIMESTAMP()`,
    Number(userId),
    String(status),
    String(source),
    Number(markedBy),
  );
  return findAccessByUserId(userId);
}
