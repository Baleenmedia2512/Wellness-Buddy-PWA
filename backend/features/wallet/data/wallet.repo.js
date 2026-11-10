/**
 * Wallet tables. Created on first use so this feature does not require a
 * Prisma regenerate or a change to existing tables.
 */
import { getPrisma } from '../../../shared/lib/prisma.js';
import logger from '../../../shared/lib/logger.js';
import {
  REQUEST_STATUS_APPROVED,
  REQUEST_STATUS_CANCELLED,
  REQUEST_STATUS_EXPIRED,
  REQUEST_STATUS_PENDING,
  WALLET_OTP_MINUTES,
} from '../domain/wallet.rules.js';

const CREATE_WALLETS_SQL = `CREATE TABLE IF NOT EXISTS wallets_table (
  Id        BIGINT        NOT NULL AUTO_INCREMENT,
  UserId    BIGINT        NOT NULL,
  Balance   DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  CreatedAt DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (Id),
  UNIQUE KEY uq_wallets_user (UserId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;

const CREATE_REQUESTS_SQL = `CREATE TABLE IF NOT EXISTS wallet_cash_requests_table (
  Id           BIGINT        NOT NULL AUTO_INCREMENT,
  RequesterId  BIGINT        NOT NULL,
  ApproverId   BIGINT        NOT NULL,
  Amount       DECIMAL(12,2) NOT NULL,
  OtpHash      VARCHAR(255)  NOT NULL,
  OtpExpiresAt DATETIME      NOT NULL,
  OtpSentAt    DATETIME      NULL,
  OtpAttempts  INT           NOT NULL DEFAULT 0,
  Status       VARCHAR(20)   NOT NULL DEFAULT 'pending',
  RequestedAt  DATETIME      NOT NULL,
  ProcessedAt  DATETIME      NULL,
  PRIMARY KEY (Id),
  KEY idx_wallet_cash_requester_status (RequesterId, Status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;

const CREATE_LEDGER_SQL = `CREATE TABLE IF NOT EXISTS wallet_ledger_table (
  Id            BIGINT        NOT NULL AUTO_INCREMENT,
  WalletUserId  BIGINT        NOT NULL,
  RequestId     BIGINT        NOT NULL,
  Amount        DECIMAL(12,2) NOT NULL,
  BalanceAfter  DECIMAL(12,2) NOT NULL,
  CreatedAt     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (Id),
  KEY idx_wallet_ledger_user (WalletUserId, CreatedAt),
  KEY idx_wallet_ledger_request (RequestId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;

let ensurePromise = null;

function toNumber(value, fallback = 0) {
  if (value == null) return fallback;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'object' && typeof value.toNumber === 'function') {
    return value.toNumber();
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function mapWalletRow(row) {
  if (!row) return null;
  return {
    Id: toNumber(row.Id),
    UserId: toNumber(row.UserId),
    Balance: toNumber(row.Balance),
  };
}

function mapRequestRow(row) {
  if (!row) return null;
  return {
    Id: toNumber(row.Id),
    RequesterId: toNumber(row.RequesterId),
    ApproverId: toNumber(row.ApproverId),
    Amount: toNumber(row.Amount),
    OtpHash: row.OtpHash ? String(row.OtpHash) : '',
    OtpExpiresAt: row.OtpExpiresAt,
    OtpSentAt: row.OtpSentAt,
    OtpAttempts: toNumber(row.OtpAttempts),
    Status: row.Status ? String(row.Status) : '',
    RequestedAt: row.RequestedAt,
    ProcessedAt: row.ProcessedAt,
    IsExpired: Boolean(toNumber(row.IsExpired, 0)),
  };
}

async function ensureTables() {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      const prisma = getPrisma();
      await prisma.$executeRawUnsafe(CREATE_WALLETS_SQL);
      await prisma.$executeRawUnsafe(CREATE_REQUESTS_SQL);
      await prisma.$executeRawUnsafe(CREATE_LEDGER_SQL);
    })().catch((error) => {
      ensurePromise = null;
      logger.warn('wallet tables could not be prepared', {
        message: error?.message || String(error),
      });
      throw error;
    });
  }
  return ensurePromise;
}

export async function getOrCreateWallet(userId) {
  await ensureTables();
  const prisma = getPrisma();
  const uid = Number(userId);
  await prisma.$executeRawUnsafe(
    `INSERT INTO wallets_table (UserId, Balance, CreatedAt, UpdatedAt)
     VALUES (?, 0.00, UTC_TIMESTAMP(), UTC_TIMESTAMP())
     ON DUPLICATE KEY UPDATE UserId = UserId`,
    uid,
  );
  const rows = await prisma.$queryRawUnsafe(
    `SELECT Id, UserId, Balance FROM wallets_table WHERE UserId = ? LIMIT 1`,
    uid,
  );
  return mapWalletRow(Array.isArray(rows) ? rows[0] : null);
}

export async function findPendingByRequesterId(requesterId) {
  await ensureTables();
  const rows = await getPrisma().$queryRawUnsafe(
    `SELECT Id, RequesterId, ApproverId, Amount, OtpHash, OtpExpiresAt, OtpSentAt,
            OtpAttempts, Status, RequestedAt, ProcessedAt,
            (OtpExpiresAt <= UTC_TIMESTAMP()) AS IsExpired
     FROM wallet_cash_requests_table
     WHERE RequesterId = ? AND Status = ?
     ORDER BY Id DESC
     LIMIT 1`,
    Number(requesterId),
    REQUEST_STATUS_PENDING,
  );
  return mapRequestRow(Array.isArray(rows) ? rows[0] : null);
}

export async function cancelPendingByRequesterId(requesterId) {
  await ensureTables();
  await getPrisma().$executeRawUnsafe(
    `UPDATE wallet_cash_requests_table
     SET Status = ?, ProcessedAt = UTC_TIMESTAMP()
     WHERE RequesterId = ? AND Status = ?`,
    REQUEST_STATUS_CANCELLED,
    Number(requesterId),
    REQUEST_STATUS_PENDING,
  );
}

export async function cancelPendingById(id) {
  await ensureTables();
  await getPrisma().$executeRawUnsafe(
    `UPDATE wallet_cash_requests_table
     SET Status = ?, ProcessedAt = UTC_TIMESTAMP()
     WHERE Id = ? AND Status = ?`,
    REQUEST_STATUS_CANCELLED,
    Number(id),
    REQUEST_STATUS_PENDING,
  );
}

export async function insertCashRequest({
  requesterId,
  approverId,
  amount,
  otpHash,
  expiresMinutes = WALLET_OTP_MINUTES,
}) {
  await ensureTables();
  const prisma = getPrisma();
  const uid = Number(requesterId);
  const minutes = Number.parseInt(String(expiresMinutes), 10);
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) {
    throw new Error('Invalid wallet OTP expiry');
  }
  await prisma.$executeRawUnsafe(
    `INSERT INTO wallet_cash_requests_table
      (RequesterId, ApproverId, Amount, OtpHash, OtpExpiresAt, OtpSentAt, OtpAttempts, Status, RequestedAt)
     VALUES (?, ?, ?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ${minutes} MINUTE), NULL, 0, ?, UTC_TIMESTAMP())`,
    uid,
    Number(approverId),
    Number(amount),
    String(otpHash),
    REQUEST_STATUS_PENDING,
  );
  return findPendingByRequesterId(uid);
}

export async function markOtpEmailSent(id) {
  await ensureTables();
  await getPrisma().$executeRawUnsafe(
    `UPDATE wallet_cash_requests_table
     SET OtpSentAt = UTC_TIMESTAMP()
     WHERE Id = ? AND Status = ?`,
    Number(id),
    REQUEST_STATUS_PENDING,
  );
}

export async function incrementOtpAttempts(id, nextAttempts) {
  await ensureTables();
  await getPrisma().$executeRawUnsafe(
    `UPDATE wallet_cash_requests_table SET OtpAttempts = ? WHERE Id = ?`,
    Number(nextAttempts),
    Number(id),
  );
}

export async function markExpired(id) {
  await ensureTables();
  await getPrisma().$executeRawUnsafe(
    `UPDATE wallet_cash_requests_table
     SET Status = ?, ProcessedAt = UTC_TIMESTAMP()
     WHERE Id = ? AND Status = ?`,
    REQUEST_STATUS_EXPIRED,
    Number(id),
    REQUEST_STATUS_PENDING,
  );
}

/**
 * Credit the requester wallet exactly once for this pending request.
 * @returns {Promise<{ balance: number }>}
 */
export async function approveAndCredit({ requestId, requesterId, amount }) {
  await ensureTables();
  const prisma = getPrisma();
  const rid = Number(requestId);
  const uid = Number(requesterId);
  const cash = Number(amount);

  return prisma.$transaction(async (tx) => {
    const pending = await tx.$queryRawUnsafe(
      `SELECT Id, Status FROM wallet_cash_requests_table
       WHERE Id = ? AND RequesterId = ? AND Status = ?
       LIMIT 1 FOR UPDATE`,
      rid,
      uid,
      REQUEST_STATUS_PENDING,
    );
    if (!Array.isArray(pending) || !pending[0]) {
      throw new Error('WALLET_REQUEST_NOT_PENDING');
    }

    await tx.$executeRawUnsafe(
      `INSERT INTO wallets_table (UserId, Balance, CreatedAt, UpdatedAt)
       VALUES (?, 0.00, UTC_TIMESTAMP(), UTC_TIMESTAMP())
       ON DUPLICATE KEY UPDATE UserId = UserId`,
      uid,
    );

    await tx.$executeRawUnsafe(
      `UPDATE wallets_table
       SET Balance = ROUND(Balance + ?, 2), UpdatedAt = UTC_TIMESTAMP()
       WHERE UserId = ?`,
      cash,
      uid,
    );

    const wallets = await tx.$queryRawUnsafe(
      `SELECT Balance FROM wallets_table WHERE UserId = ? LIMIT 1 FOR UPDATE`,
      uid,
    );
    const balance = toNumber(Array.isArray(wallets) ? wallets[0]?.Balance : 0);

    await tx.$executeRawUnsafe(
      `UPDATE wallet_cash_requests_table
       SET Status = ?, ProcessedAt = UTC_TIMESTAMP()
       WHERE Id = ? AND Status = ?`,
      REQUEST_STATUS_APPROVED,
      rid,
      REQUEST_STATUS_PENDING,
    );

    await tx.$executeRawUnsafe(
      `INSERT INTO wallet_ledger_table (WalletUserId, RequestId, Amount, BalanceAfter, CreatedAt)
       VALUES (?, ?, ?, ?, UTC_TIMESTAMP())`,
      uid,
      rid,
      cash,
      balance,
    );

    return { balance };
  });
}
