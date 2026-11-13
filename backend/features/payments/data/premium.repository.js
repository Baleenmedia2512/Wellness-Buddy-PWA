/**
 * Paid Premium orders. One row per Cashfree order that was confirmed PAID.
 * Premium access lasts until ExpiresAt (India calendar day), not forever.
 *
 * Plain SQL on purpose: the table is created here on first use, so deploys do
 * not need a Prisma client regenerate or a manual migration to keep working.
 * Same table as backend/migrations/create_premium_orders_table.sql /
 * add_expires_at_to_premium_orders.sql.
 */
import { getPrisma } from '../../../shared/lib/prisma.js';
import logger from '../../../shared/lib/logger.js';
import { todayInTimezone, timestampToCalendarYmd, IANA_IST } from '../../../shared/lib/datetime/datetime.js';
import {
  computeExtendedExpiresYmd,
  premiumExpiresAtToYmd,
  resolvePremiumMembership,
} from '../domain/premium-subscription.rules.js';

const CREATE_TABLE_SQL = `CREATE TABLE IF NOT EXISTS premium_orders_table (
  Id        BIGINT        NOT NULL AUTO_INCREMENT,
  OrderId   VARCHAR(64)   NOT NULL,
  UserId    BIGINT        NOT NULL,
  Amount    DECIMAL(10,2) NOT NULL,
  Mode      VARCHAR(16)   NOT NULL,
  Status    VARCHAR(16)   NOT NULL DEFAULT 'paid',
  PaidAt    DATETIME      NOT NULL,
  ExpiresAt DATETIME      NULL,
  CreatedAt DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (Id),
  UNIQUE KEY uq_premium_orders_order (OrderId),
  KEY idx_premium_orders_user_mode (UserId, Mode, Status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;

const ADD_EXPIRES_AT_SQL = `ALTER TABLE premium_orders_table
  ADD COLUMN ExpiresAt DATETIME NULL AFTER PaidAt`;

const BACKFILL_EXPIRES_AT_SQL = `UPDATE premium_orders_table
  SET ExpiresAt = DATE_ADD(UTC_TIMESTAMP(), INTERVAL 30 DAY)
  WHERE Status = 'paid' AND ExpiresAt IS NULL`;

let ensurePromise = null;

function expiresYmdFromDb(value) {
  return premiumExpiresAtToYmd(value, (raw) => {
    if (raw == null || raw === '') return null;
    return timestampToCalendarYmd(raw, IANA_IST);
  });
}

async function ensureExpiresAtColumn(prisma) {
  try {
    await prisma.$executeRawUnsafe(ADD_EXPIRES_AT_SQL);
  } catch (error) {
    const message = String(error?.message || error || '');
    // MySQL duplicate column / already migrated
    if (!/duplicate column|1060/i.test(message)) {
      throw error;
    }
  }
  try {
    await prisma.$executeRawUnsafe(BACKFILL_EXPIRES_AT_SQL);
  } catch (error) {
    logger.warn('premium ExpiresAt backfill skipped', {
      message: error?.message || String(error),
    });
  }
}

async function ensureTable() {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      const prisma = getPrisma();
      await prisma.$executeRawUnsafe(CREATE_TABLE_SQL);
      await ensureExpiresAtColumn(prisma);
    })().catch((error) => {
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
 * Latest ExpiresAt YMD for this member in this Cashfree mode.
 * @param {{ userId: number, mode: string }} input
 * @returns {Promise<string|null>}
 */
async function findLatestExpiresYmd({ userId, mode }) {
  const rows = await getPrisma().$queryRawUnsafe(
    `SELECT ExpiresAt AS expiresAt FROM premium_orders_table
     WHERE UserId = ? AND Mode = ? AND Status = 'paid' AND ExpiresAt IS NOT NULL
     ORDER BY ExpiresAt DESC
     LIMIT 1`,
    Number(userId),
    String(mode),
  );
  if (!Array.isArray(rows) || !rows.length) return null;
  return expiresYmdFromDb(rows[0].expiresAt ?? rows[0].ExpiresAt);
}

/**
 * Save one confirmed-paid order and set/extend the 30-day window.
 * Safe to call again for the same order (does not re-extend).
 * @param {{
 *   orderId: string,
 *   userId: number,
 *   amount: number,
 *   mode: 'sandbox'|'production',
 *   todayYmd?: string,
 * }} input
 * @returns {Promise<{ expiresAt: string|null }>}
 */
export async function recordPaidPremiumOrder({ orderId, userId, amount, mode, todayYmd }) {
  await ensureTable();
  const today = todayYmd || todayInTimezone(IANA_IST);
  const currentExpiresYmd = await findLatestExpiresYmd({ userId, mode });
  const expiresAt = computeExtendedExpiresYmd({
    currentExpiresYmd,
    todayYmd: today,
  });
  if (!expiresAt) {
    throw new Error('Could not compute Premium expiry');
  }

  await getPrisma().$executeRawUnsafe(
    `INSERT INTO premium_orders_table (OrderId, UserId, Amount, Mode, Status, PaidAt, ExpiresAt)
     VALUES (?, ?, ?, ?, 'paid', UTC_TIMESTAMP(), ?)
     ON DUPLICATE KEY UPDATE Status = 'paid'`,
    String(orderId),
    Number(userId),
    Number(amount),
    String(mode),
    `${expiresAt} 00:00:00`,
  );

  // Re-read so a duplicate confirm does not pretend the window was extended again.
  const savedExpiresAt = await findLatestExpiresYmd({ userId, mode });
  return { expiresAt: savedExpiresAt || expiresAt };
}

/**
 * Active Premium membership for this member (not merely "ever paid").
 * @param {{ userId: number, mode: 'sandbox'|'production', todayYmd?: string }} input
 * @returns {Promise<{
 *   premium: boolean,
 *   daysLeft: number|null,
 *   expiresAt: string|null,
 *   showExpiryWarning: boolean,
 * }>}
 */
export async function getPremiumMembership({ userId, mode, todayYmd }) {
  await ensureTable();
  const today = todayYmd || todayInTimezone(IANA_IST);
  const expiresAtYmd = await findLatestExpiresYmd({ userId, mode });
  return resolvePremiumMembership({ expiresAtYmd, todayYmd: today });
}

/**
 * Sandbox test payments never count on production and the other way round.
 * @param {{ userId: number, mode: 'sandbox'|'production', todayYmd?: string }} input
 * @returns {Promise<boolean>}
 */
export async function hasPaidPremium(input) {
  const membership = await getPremiumMembership(input);
  return membership.premium === true;
}

/**
 * Mark ranked people who have an active Premium window.
 * Extra `isPremium` on a list is safe for older apps: they ignore unknown fields.
 * If the lookup fails, every row stays non-premium so the list still loads.
 * @param {Array<object>} entries
 * @param {{ mode: 'sandbox'|'production', todayYmd?: string }} input
 * @returns {Promise<Array<object>>}
 */
export async function attachPremiumFlags(entries, { mode, todayYmd }) {
  const list = Array.isArray(entries) ? entries : [];
  const plain = () => list.map((entry) => ({ ...entry, isPremium: false }));
  const ids = [...new Set(
    list
      .map((entry) => Number(entry?.userId))
      .filter((id) => Number.isInteger(id) && id > 0),
  )];
  if (!ids.length) return plain();

  try {
    await ensureTable();
    const today = todayYmd || todayInTimezone(IANA_IST);
    const placeholders = ids.map(() => '?').join(', ');
    const rows = await getPrisma().$queryRawUnsafe(
      `SELECT UserId AS userId, MAX(ExpiresAt) AS expiresAt FROM premium_orders_table
       WHERE Mode = ? AND Status = 'paid' AND ExpiresAt IS NOT NULL
         AND UserId IN (${placeholders})
       GROUP BY UserId`,
      String(mode),
      ...ids,
    );
    const paid = new Set();
    for (const row of rows || []) {
      const expiresAtYmd = expiresYmdFromDb(row.expiresAt ?? row.ExpiresAt);
      const membership = resolvePremiumMembership({ expiresAtYmd, todayYmd: today });
      if (membership.premium) paid.add(Number(row.userId ?? row.UserId));
    }
    return list.map((entry) => ({
      ...entry,
      isPremium: paid.has(Number(entry.userId)),
    }));
  } catch (error) {
    logger.warn('premium flags skipped', { message: error?.message || String(error) });
    return plain();
  }
}
