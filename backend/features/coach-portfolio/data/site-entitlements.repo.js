/**
 * Per-site yearly entitlements for Digital Portfolio.
 * Table ensured on first use (same pattern as premium_orders_table).
 */
import { getPrisma } from '../../../shared/lib/prisma.js';
import logger from '../../../shared/lib/logger.js';
import {
  PORTFOLIO_SITE_ENTITLEMENT_STATUS,
  PORTFOLIO_SITE_ORDER_KIND,
  computeExtendedExpiresAt,
  countUnusedCredits,
  isSubmissionEntitlementActive,
  latestExpiryForSubmission,
} from '../domain/siteSlots.rules.js';

const CREATE_TABLE_SQL = `CREATE TABLE IF NOT EXISTS coach_portfolio_site_entitlements_table (
  Id            BIGINT        NOT NULL AUTO_INCREMENT,
  OrderId       VARCHAR(64)   NOT NULL,
  UserId        BIGINT        NOT NULL,
  Amount        DECIMAL(10,2) NOT NULL,
  Mode          VARCHAR(16)   NOT NULL,
  Status        VARCHAR(16)   NOT NULL DEFAULT 'pending',
  Kind          VARCHAR(16)   NOT NULL DEFAULT 'credit',
  PaidAt        DATETIME      NULL,
  ExpiresAt     DATETIME      NULL,
  SubmissionId  BIGINT        NULL,
  CenterId      BIGINT        NULL,
  CreatedAt     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (Id),
  UNIQUE KEY uq_portfolio_site_entitlement_order (OrderId),
  KEY idx_portfolio_site_entitlement_user_exp (UserId, Status, ExpiresAt),
  KEY idx_portfolio_site_entitlement_submission (SubmissionId),
  KEY idx_portfolio_site_entitlement_center (CenterId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;

const BACKFILL_PUBLISHED_SQL = `
INSERT INTO coach_portfolio_site_entitlements_table
  (OrderId, UserId, Amount, Mode, Status, Kind, PaidAt, ExpiresAt, SubmissionId, CenterId)
SELECT
  CONCAT('backfill_pub_', s.Id),
  s.UserId,
  0,
  'backfill',
  'paid',
  'credit',
  UTC_TIMESTAMP(),
  DATE_ADD(UTC_TIMESTAMP(), INTERVAL 365 DAY),
  s.Id,
  s.CenterId
FROM coach_portfolio_submissions_table s
WHERE s.IsPublished = 1
  AND NOT EXISTS (
    SELECT 1 FROM coach_portfolio_site_entitlements_table e
    WHERE e.SubmissionId = s.Id AND e.Status = 'paid'
  )`;

let ensurePromise = null;

async function ensureTable() {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      const prisma = getPrisma();
      await prisma.$executeRawUnsafe(CREATE_TABLE_SQL);
      try {
        await prisma.$executeRawUnsafe(BACKFILL_PUBLISHED_SQL);
      } catch (error) {
        logger.warn('portfolio site entitlement backfill skipped', {
          message: error?.message || String(error),
        });
      }
    })().catch((error) => {
      ensurePromise = null;
      logger.warn('coach_portfolio_site_entitlements_table could not be prepared', {
        message: error?.message || String(error),
      });
      throw error;
    });
  }
  return ensurePromise;
}

function mapRow(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    orderId: String(row.orderId || ''),
    userId: Number(row.userId),
    amount: Number(row.amount),
    mode: String(row.mode || ''),
    status: String(row.status || ''),
    kind: String(row.kind || PORTFOLIO_SITE_ORDER_KIND.CREDIT),
    paidAt: row.paidAt ?? null,
    expiresAt: row.expiresAt ?? null,
    submissionId: row.submissionId != null ? Number(row.submissionId) : null,
    centerId: row.centerId != null ? Number(row.centerId) : null,
  };
}

/**
 * @param {number} userId
 */
export async function listEntitlementsByUserId(userId) {
  await ensureTable();
  const rows = await getPrisma().$queryRawUnsafe(
    `SELECT Id AS id, OrderId AS orderId, UserId AS userId, Amount AS amount,
            Mode AS mode, Status AS status, Kind AS kind,
            PaidAt AS paidAt, ExpiresAt AS expiresAt,
            SubmissionId AS submissionId, CenterId AS centerId
     FROM coach_portfolio_site_entitlements_table
     WHERE UserId = ?
     ORDER BY Id ASC`,
    Number(userId),
  );
  return Array.isArray(rows) ? rows.map(mapRow) : [];
}

/**
 * @param {number} submissionId
 */
export async function listEntitlementsBySubmissionId(submissionId) {
  await ensureTable();
  const rows = await getPrisma().$queryRawUnsafe(
    `SELECT Id AS id, OrderId AS orderId, UserId AS userId, Amount AS amount,
            Mode AS mode, Status AS status, Kind AS kind,
            PaidAt AS paidAt, ExpiresAt AS expiresAt,
            SubmissionId AS submissionId, CenterId AS centerId
     FROM coach_portfolio_site_entitlements_table
     WHERE SubmissionId = ? AND Status = 'paid'
     ORDER BY ExpiresAt DESC`,
    Number(submissionId),
  );
  return Array.isArray(rows) ? rows.map(mapRow) : [];
}

/**
 * @param {number} userId
 * @param {number} [nowMs]
 */
export async function getUnusedCreditCount(userId, nowMs = Date.now()) {
  const rows = await listEntitlementsByUserId(userId);
  return countUnusedCredits(rows, nowMs);
}

/**
 * @param {number} submissionId
 * @param {number} [nowMs]
 */
export async function isSubmissionActive(submissionId, nowMs = Date.now()) {
  const rows = await listEntitlementsBySubmissionId(submissionId);
  return isSubmissionEntitlementActive(rows, submissionId, nowMs);
}

/**
 * Insert pending order intent (credit or renew).
 * @param {{
 *   orderId: string,
 *   userId: number,
 *   amount: number,
 *   mode: string,
 *   kind?: string,
 *   submissionId?: number|null,
 *   centerId?: number|null,
 * }} input
 */
export async function insertPendingEntitlement(input) {
  await ensureTable();
  await getPrisma().$executeRawUnsafe(
    `INSERT INTO coach_portfolio_site_entitlements_table
      (OrderId, UserId, Amount, Mode, Status, Kind, SubmissionId, CenterId)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    String(input.orderId),
    Number(input.userId),
    Number(input.amount),
    String(input.mode),
    PORTFOLIO_SITE_ENTITLEMENT_STATUS.PENDING,
    String(input.kind || PORTFOLIO_SITE_ORDER_KIND.CREDIT),
    input.submissionId != null ? Number(input.submissionId) : null,
    input.centerId != null ? Number(input.centerId) : null,
  );
}

/**
 * Confirm PAID: set PaidAt + ExpiresAt. Renew extends from current site expiry.
 * @param {{ orderId: string, userId: number, amount: number, mode: string, nowMs?: number }} input
 */
export async function confirmPaidEntitlement(input) {
  await ensureTable();
  const nowMs = input.nowMs ?? Date.now();
  const rows = await getPrisma().$queryRawUnsafe(
    `SELECT Id AS id, OrderId AS orderId, UserId AS userId, Amount AS amount,
            Mode AS mode, Status AS status, Kind AS kind,
            PaidAt AS paidAt, ExpiresAt AS expiresAt,
            SubmissionId AS submissionId, CenterId AS centerId
     FROM coach_portfolio_site_entitlements_table
     WHERE OrderId = ?
     LIMIT 1`,
    String(input.orderId),
  );
  const existing = Array.isArray(rows) && rows[0] ? mapRow(rows[0]) : null;

  if (existing && existing.status === PORTFOLIO_SITE_ENTITLEMENT_STATUS.PAID) {
    return existing;
  }

  if (existing) {
    let expiresAt;
    if (
      existing.kind === PORTFOLIO_SITE_ORDER_KIND.RENEW
      && existing.submissionId != null
    ) {
      const bound = await listEntitlementsBySubmissionId(existing.submissionId);
      const current = latestExpiryForSubmission(bound, existing.submissionId);
      expiresAt = computeExtendedExpiresAt(current, nowMs);
    } else {
      expiresAt = computeExtendedExpiresAt(null, nowMs);
    }
    await getPrisma().$executeRawUnsafe(
      `UPDATE coach_portfolio_site_entitlements_table
       SET Status = ?, PaidAt = UTC_TIMESTAMP(), ExpiresAt = ?, Amount = ?, Mode = ?
       WHERE OrderId = ? AND UserId = ?`,
      PORTFOLIO_SITE_ENTITLEMENT_STATUS.PAID,
      expiresAt,
      Number(input.amount),
      String(input.mode),
      String(input.orderId),
      Number(input.userId),
    );
    const refreshed = await getPrisma().$queryRawUnsafe(
      `SELECT Id AS id, OrderId AS orderId, UserId AS userId, Amount AS amount,
              Mode AS mode, Status AS status, Kind AS kind,
              PaidAt AS paidAt, ExpiresAt AS expiresAt,
              SubmissionId AS submissionId, CenterId AS centerId
       FROM coach_portfolio_site_entitlements_table
       WHERE OrderId = ?
       LIMIT 1`,
      String(input.orderId),
    );
    return mapRow(refreshed?.[0]);
  }

  // Confirm without pending row (shouldn't happen) — insert paid credit.
  const expiresAt = computeExtendedExpiresAt(null, nowMs);
  await getPrisma().$executeRawUnsafe(
    `INSERT INTO coach_portfolio_site_entitlements_table
      (OrderId, UserId, Amount, Mode, Status, Kind, PaidAt, ExpiresAt)
     VALUES (?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(), ?)`,
    String(input.orderId),
    Number(input.userId),
    Number(input.amount),
    String(input.mode),
    PORTFOLIO_SITE_ENTITLEMENT_STATUS.PAID,
    PORTFOLIO_SITE_ORDER_KIND.CREDIT,
    expiresAt,
  );
  const inserted = await getPrisma().$queryRawUnsafe(
    `SELECT Id AS id, OrderId AS orderId, UserId AS userId, Amount AS amount,
            Mode AS mode, Status AS status, Kind AS kind,
            PaidAt AS paidAt, ExpiresAt AS expiresAt,
            SubmissionId AS submissionId, CenterId AS centerId
     FROM coach_portfolio_site_entitlements_table
     WHERE OrderId = ?
     LIMIT 1`,
    String(input.orderId),
  );
  return mapRow(inserted?.[0]);
}

/**
 * Bind one unused credit to a new submission.
 * @param {{ userId: number, submissionId: number, centerId?: number|null, nowMs?: number }} input
 * @returns {Promise<object|null>}
 */
export async function bindUnusedCreditToSubmission(input) {
  await ensureTable();
  const nowMs = input.nowMs ?? Date.now();
  const rows = await listEntitlementsByUserId(input.userId);
  const unused = rows.find((row) => {
    if (row.status !== PORTFOLIO_SITE_ENTITLEMENT_STATUS.PAID) return false;
    if (row.submissionId != null && Number(row.submissionId) > 0) return false;
    const ms = row.expiresAt instanceof Date
      ? row.expiresAt.getTime()
      : Date.parse(String(row.expiresAt || ''));
    return Number.isFinite(ms) && ms > nowMs;
  });
  if (!unused) return null;

  await getPrisma().$executeRawUnsafe(
    `UPDATE coach_portfolio_site_entitlements_table
     SET SubmissionId = ?, CenterId = ?
     WHERE Id = ? AND UserId = ? AND SubmissionId IS NULL AND Status = 'paid'`,
    Number(input.submissionId),
    input.centerId != null ? Number(input.centerId) : null,
    Number(unused.id),
    Number(input.userId),
  );
  return {
    ...unused,
    submissionId: Number(input.submissionId),
    centerId: input.centerId != null ? Number(input.centerId) : null,
  };
}

/**
 * Admin / test: grant one unbound 365d credit.
 * @param {{ userId: number, markedBy: number, nowMs?: number }} input
 */
export async function grantAdminCredit(input) {
  await ensureTable();
  const nowMs = input.nowMs ?? Date.now();
  const orderId = `admin_${input.userId}_${nowMs.toString(36)}`.slice(0, 64);
  const expiresAt = computeExtendedExpiresAt(null, nowMs);
  await getPrisma().$executeRawUnsafe(
    `INSERT INTO coach_portfolio_site_entitlements_table
      (OrderId, UserId, Amount, Mode, Status, Kind, PaidAt, ExpiresAt)
     VALUES (?, ?, 0, 'admin', 'paid', 'credit', UTC_TIMESTAMP(), ?)`,
    orderId,
    Number(input.userId),
    expiresAt,
  );
  return { orderId, expiresAt, userId: Number(input.userId) };
}

/**
 * Site credit summary for API.
 * @param {number} userId
 * @param {number} [nowMs]
 */
export async function getSiteCreditsSummary(userId, nowMs = Date.now()) {
  const rows = await listEntitlementsByUserId(userId);
  const unusedCredits = countUnusedCredits(rows, nowMs);
  const bySubmission = new Map();
  for (const row of rows) {
    if (row.status !== PORTFOLIO_SITE_ENTITLEMENT_STATUS.PAID) continue;
    if (row.submissionId == null || !(Number(row.submissionId) > 0)) continue;
    const sid = Number(row.submissionId);
    const prev = bySubmission.get(sid);
    const ms = row.expiresAt instanceof Date
      ? row.expiresAt.getTime()
      : Date.parse(String(row.expiresAt || ''));
    if (!Number.isFinite(ms)) continue;
    if (!prev || ms > prev.expiresMs) {
      bySubmission.set(sid, {
        submissionId: sid,
        centerId: row.centerId,
        expiresAt: new Date(ms).toISOString(),
        expiresMs: ms,
        active: ms > nowMs,
      });
    }
  }
  const sites = [...bySubmission.values()].map(({ expiresMs, ...rest }) => rest);
  return { unusedCredits, sites };
}
