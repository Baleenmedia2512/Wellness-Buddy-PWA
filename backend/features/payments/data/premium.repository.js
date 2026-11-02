/**
 * Paid Premium orders. One row per Cashfree order that was confirmed PAID.
 *
 * Plain SQL on purpose: the table is created here on first use, so deploys do
 * not need a Prisma client regenerate or a manual migration to keep working.
 * Same table as backend/migrations/create_premium_orders_table.sql.
 */
import { getPrisma } from '../../../shared/lib/prisma.js';
import logger from '../../../shared/lib/logger.js';

const CREATE_TABLE_SQL = `CREATE TABLE IF NOT EXISTS premium_orders_table (
  Id        BIGINT        NOT NULL AUTO_INCREMENT,
  OrderId   VARCHAR(64)   NOT NULL,
  UserId    BIGINT        NOT NULL,
  Amount    DECIMAL(10,2) NOT NULL,
  Mode      VARCHAR(16)   NOT NULL,
  Status    VARCHAR(16)   NOT NULL DEFAULT 'paid',
  PaidAt    DATETIME      NOT NULL,
  CreatedAt DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (Id),
  UNIQUE KEY uq_premium_orders_order (OrderId),
  KEY idx_premium_orders_user_mode (UserId, Mode, Status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;

let ensurePromise = null;

async function ensureTable() {
  if (!ensurePromise) {
    ensurePromise = getPrisma()
      .$executeRawUnsafe(CREATE_TABLE_SQL)
      .catch((error) => {
        ensurePromise = null;
        logger.warn('premium_orders_table could not be prepared', {
          message: error?.message || String(error),
        });
        throw error;
      });
  }
  return ensurePromise;
}

/**
 * Save one confirmed-paid order. Safe to call again for the same order.
 * @param {{ orderId: string, userId: number, amount: number, mode: 'sandbox'|'production' }} input
 */
export async function recordPaidPremiumOrder({ orderId, userId, amount, mode }) {
  await ensureTable();
  await getPrisma().$executeRawUnsafe(
    `INSERT INTO premium_orders_table (OrderId, UserId, Amount, Mode, Status, PaidAt)
     VALUES (?, ?, ?, ?, 'paid', UTC_TIMESTAMP())
     ON DUPLICATE KEY UPDATE Status = 'paid'`,
    String(orderId),
    Number(userId),
    Number(amount),
    String(mode),
  );
}

/**
 * Sandbox test payments never count on production and the other way round.
 * @param {{ userId: number, mode: 'sandbox'|'production' }} input
 * @returns {Promise<boolean>}
 */
export async function hasPaidPremium({ userId, mode }) {
  await ensureTable();
  const rows = await getPrisma().$queryRawUnsafe(
    `SELECT 1 AS ok FROM premium_orders_table
     WHERE UserId = ? AND Mode = ? AND Status = 'paid'
     LIMIT 1`,
    Number(userId),
    String(mode),
  );
  return Array.isArray(rows) && rows.length > 0;
}
