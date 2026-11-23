/**
 * One-click coach reject tokens for Task by Coach (after OTP verify / score applied).
 */
import { getPrisma } from '../../../shared/lib/prisma.js';
import logger from '../../../shared/lib/logger.js';

const CREATE_TABLE_SQL = `CREATE TABLE IF NOT EXISTS good_habit_reject_tokens_table (
  Id            BIGINT       NOT NULL AUTO_INCREMENT,
  Token         VARCHAR(64)  NOT NULL,
  HabitId       BIGINT       NOT NULL,
  UserId        BIGINT       NOT NULL,
  CoachUserId   BIGINT       NOT NULL,
  ExpiresAt     DATETIME     NOT NULL,
  UsedAt        DATETIME     NULL,
  CreatedAt     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (Id),
  UNIQUE KEY uq_good_habit_reject_token (Token),
  KEY idx_good_habit_reject_habit (HabitId),
  KEY idx_good_habit_reject_expires (ExpiresAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;

let ensurePromise = null;

async function ensureSchema() {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      await getPrisma().$executeRawUnsafe(CREATE_TABLE_SQL);
    })().catch((error) => {
      ensurePromise = null;
      logger.warn('good_habit_reject_tokens_table could not be prepared', {
        message: error?.message || String(error),
      });
      throw error;
    });
  }
  return ensurePromise;
}

function toMysqlDateTime(isoOrDate) {
  if (isoOrDate instanceof Date) {
    return isoOrDate.toISOString().replace('T', ' ').replace('Z', '').slice(0, 19);
  }
  return String(isoOrDate || '').replace('T', ' ').replace('Z', '').slice(0, 19);
}

/**
 * @param {{
 *   token: string,
 *   habitId: number|string,
 *   userId: number|string,
 *   coachUserId: number|string,
 *   expiresAtUtcIso: string,
 * }} input
 */
export async function insertRejectToken({
  token,
  habitId,
  userId,
  coachUserId,
  expiresAtUtcIso,
}) {
  await ensureSchema();
  const t = String(token || '').trim();
  const hid = Number(habitId);
  const uid = Number(userId);
  const cid = Number(coachUserId);
  if (!t || !Number.isFinite(hid) || hid <= 0 || !Number.isFinite(uid) || uid <= 0) {
    throw new Error('token, habitId, and userId are required');
  }
  await getPrisma().$executeRawUnsafe(
    `INSERT INTO good_habit_reject_tokens_table
      (Token, HabitId, UserId, CoachUserId, ExpiresAt)
     VALUES (?, ?, ?, ?, ?)`,
    t,
    hid,
    uid,
    Number.isFinite(cid) && cid > 0 ? cid : 0,
    toMysqlDateTime(expiresAtUtcIso),
  );
}

/**
 * @param {string} token
 * @returns {Promise<{
 *   token: string,
 *   habitId: number,
 *   userId: number,
 *   coachUserId: number,
 *   expiresAt: Date,
 *   usedAt: Date|null,
 * }|null>}
 */
export async function findRejectToken(token) {
  await ensureSchema();
  const t = String(token || '').trim();
  if (!t) return null;
  const rows = await getPrisma().$queryRawUnsafe(
    `SELECT Token AS token, HabitId AS habitId, UserId AS userId,
            CoachUserId AS coachUserId, ExpiresAt AS expiresAt, UsedAt AS usedAt
     FROM good_habit_reject_tokens_table
     WHERE Token = ?
     LIMIT 1`,
    t,
  );
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) return null;
  const expiresAt = row.expiresAt instanceof Date
    ? row.expiresAt
    : new Date(String(row.expiresAt).includes('Z') ? row.expiresAt : `${row.expiresAt}Z`);
  const usedAt = row.usedAt == null
    ? null
    : (row.usedAt instanceof Date
      ? row.usedAt
      : new Date(String(row.usedAt).includes('Z') ? row.usedAt : `${row.usedAt}Z`));
  return {
    token: String(row.token),
    habitId: Number(row.habitId),
    userId: Number(row.userId),
    coachUserId: Number(row.coachUserId),
    expiresAt,
    usedAt: Number.isFinite(usedAt?.getTime?.()) ? usedAt : null,
  };
}

/**
 * @param {string} token
 * @param {string} usedAtUtcIso
 */
export async function markRejectTokenUsed(token, usedAtUtcIso) {
  await ensureSchema();
  await getPrisma().$executeRawUnsafe(
    `UPDATE good_habit_reject_tokens_table
     SET UsedAt = ?
     WHERE Token = ? AND UsedAt IS NULL`,
    toMysqlDateTime(usedAtUtcIso),
    String(token || '').trim(),
  );
}
