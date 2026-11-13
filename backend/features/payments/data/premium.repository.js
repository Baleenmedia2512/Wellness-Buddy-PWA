/**
 * Paid Premium orders. One row per Cashfree order that was confirmed PAID.
 * Premium access lasts until the exact ExpiresAt instant, not forever.
 *
 * Plain SQL on purpose: the table is created here on first use, so deploys do
 * not need a Prisma client regenerate or a manual migration to keep working.
 * Same table as backend/migrations/create_premium_orders_table.sql /
 * add_expires_at_to_premium_orders.sql.
 */
import { getPrisma } from '../../../shared/lib/prisma.js';
import logger from '../../../shared/lib/logger.js';
import {
  todayInTimezone,
  timestampToCalendarYmd,
  formatUtcForDisplay,
  normalizeStoredTimestampToUtcIso,
  IANA_IST,
} from '../../../shared/lib/datetime/datetime.js';
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

/**
 * @param {unknown} value
 * @returns {number|null}
 */
function expiresAtMsFromDb(value) {
  if (value == null || value === '') return null;
  try {
    if (value instanceof Date) {
      const ms = value.getTime();
      return Number.isFinite(ms) ? ms : null;
    }
    const iso = normalizeStoredTimestampToUtcIso(value, IANA_IST);
    const ms = Date.parse(iso);
    return Number.isFinite(ms) ? ms : null;
  } catch {
    return null;
  }
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
 * Latest ExpiresAt raw value for this member in this Cashfree mode.
 * @param {{ userId: number, mode: string }} input
 * @returns {Promise<unknown>}
 */
async function findLatestExpiresAtRaw({ userId, mode }) {
  const rows = await getPrisma().$queryRawUnsafe(
    `SELECT ExpiresAt AS expiresAt FROM premium_orders_table
     WHERE UserId = ? AND Mode = ? AND Status = 'paid' AND ExpiresAt IS NOT NULL
     ORDER BY ExpiresAt DESC
     LIMIT 1`,
    Number(userId),
    String(mode),
  );
  if (!Array.isArray(rows) || !rows.length) return null;
  return rows[0].expiresAt ?? rows[0].ExpiresAt ?? null;
}

/**
 * Latest ExpiresAt YMD for this member in this Cashfree mode.
 * @param {{ userId: number, mode: string }} input
 * @returns {Promise<string|null>}
 */
async function findLatestExpiresYmd({ userId, mode }) {
  return expiresYmdFromDb(await findLatestExpiresAtRaw({ userId, mode }));
}

/**
 * India wall-clock label for ExpiresAt, e.g. "13 Nov 2026, 4:56 AM".
 * @param {unknown} value
 * @returns {string|null}
 */
function formatExpiresAtDisplay(value) {
  if (value == null || value === '') return null;
  try {
    return formatUtcForDisplay(value, IANA_IST, 'dd MMM yyyy, h:mm a');
  } catch {
    return null;
  }
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
export async function recordPaidPremiumOrder({ orderId, userId, amount, mode, todayYmd, nowMs }) {
  await ensureTable();
  const today = todayYmd || todayInTimezone(IANA_IST);
  const now = Number.isFinite(Number(nowMs)) ? Number(nowMs) : Date.now();
  const currentRaw = await findLatestExpiresAtRaw({ userId, mode });
  const currentExpiresYmd = expiresYmdFromDb(currentRaw);
  const currentExpiresMs = expiresAtMsFromDb(currentRaw);
  const expiresAt = computeExtendedExpiresYmd({
    currentExpiresYmd,
    currentExpiresMs,
    nowMs: now,
    todayYmd: today,
  });
  if (!expiresAt) {
    throw new Error('Could not compute Premium expiry');
  }

  // End of the expiry India calendar day so the full last day stays Premium.
  await getPrisma().$executeRawUnsafe(
    `INSERT INTO premium_orders_table (OrderId, UserId, Amount, Mode, Status, PaidAt, ExpiresAt)
     VALUES (?, ?, ?, ?, 'paid', UTC_TIMESTAMP(), ?)
     ON DUPLICATE KEY UPDATE Status = 'paid'`,
    String(orderId),
    Number(userId),
    Number(amount),
    String(mode),
    `${expiresAt} 23:59:59`,
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
 *   expiresAtDisplay: string|null,
 *   showExpiryWarning: boolean,
 * }>}
 */
export async function getPremiumMembership({ userId, mode, todayYmd, nowMs }) {
  await ensureTable();
  const today = todayYmd || todayInTimezone(IANA_IST);
  const now = Number.isFinite(Number(nowMs)) ? Number(nowMs) : Date.now();
  const expiresAtRaw = await findLatestExpiresAtRaw({ userId, mode });
  const expiresAtYmd = expiresYmdFromDb(expiresAtRaw);
  const expiresAtMs = expiresAtMsFromDb(expiresAtRaw);
  return {
    ...resolvePremiumMembership({
      expiresAtYmd,
      expiresAtMs,
      nowMs: now,
      todayYmd: today,
    }),
    expiresAtDisplay: formatExpiresAtDisplay(expiresAtRaw),
  };
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
 * True if this member ever confirmed a Premium payment in this mode
 * (active or expired). Used so free trial is offered only once.
 * @param {{ userId: number, mode: 'sandbox'|'production' }} input
 * @returns {Promise<boolean>}
 */
export async function hasEverPaidPremium({ userId, mode }) {
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

/**
 * Mark ranked people who have an active Premium window.
 * Extra `isPremium` on a list is safe for older apps: they ignore unknown fields.
 * If the lookup fails, every row stays non-premium so the list still loads.
 * @param {Array<object>} entries
 * @param {{ mode: 'sandbox'|'production', todayYmd?: string }} input
 * @returns {Promise<Array<object>>}
 */
export async function attachPremiumFlags(entries, { mode, todayYmd, nowMs }) {
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
    const now = Number.isFinite(Number(nowMs)) ? Number(nowMs) : Date.now();
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
      const raw = row.expiresAt ?? row.ExpiresAt;
      const expiresAtYmd = expiresYmdFromDb(raw);
      const membership = resolvePremiumMembership({
        expiresAtYmd,
        expiresAtMs: expiresAtMsFromDb(raw),
        nowMs: now,
        todayYmd: today,
      });
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
