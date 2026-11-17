/**
 * Short-lived Task by Coach OTP pending payloads (photo + habit fields).
 */
import { getPrisma } from '../../../shared/lib/prisma.js';
import logger from '../../../shared/lib/logger.js';

const CREATE_TABLE_SQL = `CREATE TABLE IF NOT EXISTS good_habit_otp_pending_table (
  Id          BIGINT       NOT NULL AUTO_INCREMENT,
  OtpKey      VARCHAR(64)  NOT NULL,
  UserId      BIGINT       NOT NULL,
  PayloadJson LONGTEXT     NOT NULL,
  ExpiresAt   DATETIME     NOT NULL,
  CreatedAt   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (Id),
  UNIQUE KEY uq_good_habit_otp_key (OtpKey),
  KEY idx_good_habit_otp_user (UserId),
  KEY idx_good_habit_otp_expires (ExpiresAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;

let ensurePromise = null;

async function ensureSchema() {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      await getPrisma().$executeRawUnsafe(CREATE_TABLE_SQL);
    })().catch((error) => {
      ensurePromise = null;
      logger.warn('good_habit_otp_pending_table could not be prepared', {
        message: error?.message || String(error),
      });
      throw error;
    });
  }
  return ensurePromise;
}

/**
 * @param {{ otpKey: string, userId: number|string, payload: object, expiresAtUtcIso: string }} input
 */
export async function upsertPending({ otpKey, userId, payload, expiresAtUtcIso }) {
  await ensureSchema();
  const key = String(otpKey || '').trim();
  const uid = Number(userId);
  if (!key || !Number.isFinite(uid) || uid <= 0) {
    throw new Error('otpKey and userId are required');
  }
  const json = JSON.stringify(payload || {});
  const expires = String(expiresAtUtcIso || '').replace('T', ' ').replace('Z', '').slice(0, 19);
  await getPrisma().$executeRawUnsafe(
    `INSERT INTO good_habit_otp_pending_table (OtpKey, UserId, PayloadJson, ExpiresAt)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       UserId = VALUES(UserId),
       PayloadJson = VALUES(PayloadJson),
       ExpiresAt = VALUES(ExpiresAt),
       CreatedAt = CURRENT_TIMESTAMP`,
    key,
    uid,
    json,
    expires,
  );
}

/**
 * @param {string} otpKey
 * @param {number|string} userId
 * @returns {Promise<object|null>}
 */
export async function takePending(otpKey, userId) {
  await ensureSchema();
  const key = String(otpKey || '').trim();
  const uid = Number(userId);
  const rows = await getPrisma().$queryRawUnsafe(
    `SELECT OtpKey AS otpKey, UserId AS userId, PayloadJson AS payloadJson, ExpiresAt AS expiresAt
     FROM good_habit_otp_pending_table
     WHERE OtpKey = ? AND UserId = ?
     LIMIT 1`,
    key,
    uid,
  );
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) return null;

  await getPrisma().$executeRawUnsafe(
    `DELETE FROM good_habit_otp_pending_table WHERE OtpKey = ? AND UserId = ?`,
    key,
    uid,
  );

  const expiresAt = row.expiresAt instanceof Date
    ? row.expiresAt
    : new Date(String(row.expiresAt).includes('Z') ? row.expiresAt : `${row.expiresAt}Z`);
  if (Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() < Date.now()) {
    return null;
  }

  let payload = null;
  try {
    payload = typeof row.payloadJson === 'string'
      ? JSON.parse(row.payloadJson || '{}')
      : row.payloadJson;
  } catch {
    return null;
  }
  return payload && typeof payload === 'object' ? payload : null;
}

/**
 * @param {string} otpKey
 * @param {number|string} userId
 */
export async function deletePending(otpKey, userId) {
  await ensureSchema();
  await getPrisma().$executeRawUnsafe(
    `DELETE FROM good_habit_otp_pending_table WHERE OtpKey = ? AND UserId = ?`,
    String(otpKey || '').trim(),
    Number(userId),
  );
}
