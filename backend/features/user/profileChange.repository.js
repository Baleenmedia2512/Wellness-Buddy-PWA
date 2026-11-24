/**
 * Pending unified profile-change OTP requests.
 * Raw SQL via Prisma — does not depend on mysqlTableClient catalog / prisma generate.
 */
import { getPrisma } from '../../shared/lib/prisma.js';
import { nowUtc } from '../../shared/lib/datetime/index.js';
import {
  PROFILE_CHANGE_STATUS_APPROVED,
  PROFILE_CHANGE_STATUS_CANCELLED,
  PROFILE_CHANGE_STATUS_EXPIRED,
  PROFILE_CHANGE_STATUS_PENDING,
} from './domain/profileChange.rules.js';

const TABLE = 'profile_change_requests_table';

const REQUEST_COLS = [
  'Id',
  'RequesterId',
  'ApproverId',
  'PendingPayload',
  'ChangedKeys',
  'OtpHash',
  'OtpExpiresAt',
  'OtpSentAt',
  'OtpAttempts',
  'Status',
  'RequestedAt',
  'ProcessedAt',
].join(', ');

function isMissingTable(error) {
  const msg = String(error?.message || error || '');
  return /profile_change_requests_table/i.test(msg)
    && /does not exist|not find|schema cache|relation|Unknown table|1146/i.test(msg);
}

export function isProfileChangeRequestsTableMissing(error) {
  return isMissingTable(error);
}

function plainValue(value) {
  if (typeof value === 'bigint') return Number(value);
  if (value instanceof Date) return value.toISOString();
  return value;
}

function parseJsonField(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
}

function plainRow(row) {
  if (!row || typeof row !== 'object') return null;
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    if (key === 'PendingPayload') {
      out[key] = parseJsonField(value, {});
      continue;
    }
    if (key === 'ChangedKeys') {
      const parsed = parseJsonField(value, []);
      out[key] = Array.isArray(parsed) ? parsed : [];
      continue;
    }
    out[key] = plainValue(value);
  }
  return out;
}

function asDate(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function query(sql, params = []) {
  const prisma = getPrisma();
  const rows = await prisma.$queryRawUnsafe(sql, ...params);
  return Array.isArray(rows) ? rows.map(plainRow) : [];
}

export async function findPendingByRequesterId(requesterId) {
  const uid = Number(requesterId);
  if (!Number.isFinite(uid)) return null;
  try {
    const rows = await query(
      `SELECT ${REQUEST_COLS} FROM ${TABLE}
       WHERE RequesterId = ? AND Status = ?
       ORDER BY RequestedAt DESC
       LIMIT 1`,
      [uid, PROFILE_CHANGE_STATUS_PENDING],
    );
    return rows[0] || null;
  } catch (error) {
    if (isMissingTable(error)) return null;
    throw error;
  }
}

export async function cancelPendingByRequesterId(requesterId) {
  const uid = Number(requesterId);
  if (!Number.isFinite(uid)) return;
  try {
    const prisma = getPrisma();
    await prisma.$executeRawUnsafe(
      `UPDATE ${TABLE}
       SET Status = ?, ProcessedAt = ?
       WHERE RequesterId = ? AND Status = ?`,
      PROFILE_CHANGE_STATUS_CANCELLED,
      asDate(nowUtc()),
      uid,
      PROFILE_CHANGE_STATUS_PENDING,
    );
  } catch (error) {
    if (isMissingTable(error)) return;
    throw error;
  }
}

export async function insertRequest(row) {
  const prisma = getPrisma();
  const payloadJson = typeof row.PendingPayload === 'string'
    ? row.PendingPayload
    : JSON.stringify(row.PendingPayload || {});
  const keysJson = typeof row.ChangedKeys === 'string'
    ? row.ChangedKeys
    : JSON.stringify(Array.isArray(row.ChangedKeys) ? row.ChangedKeys : []);

  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO ${TABLE}
        (RequesterId, ApproverId, PendingPayload, ChangedKeys, OtpHash, OtpExpiresAt, OtpSentAt, OtpAttempts, Status, RequestedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      Number(row.RequesterId),
      Number(row.ApproverId),
      payloadJson,
      keysJson,
      row.OtpHash,
      asDate(row.OtpExpiresAt),
      asDate(row.OtpSentAt),
      Number(row.OtpAttempts) || 0,
      row.Status || PROFILE_CHANGE_STATUS_PENDING,
      asDate(row.RequestedAt) || asDate(nowUtc()),
    );
  } catch (error) {
    if (isMissingTable(error)) {
      throw new Error(
        'profile_change_requests_table is missing. Run backend/migrations/create_profile_change_requests_table.sql',
      );
    }
    throw error;
  }
  return findPendingByRequesterId(row.RequesterId);
}

export async function incrementOtpAttempts(id, nextAttempts) {
  const prisma = getPrisma();
  await prisma.$executeRawUnsafe(
    `UPDATE ${TABLE} SET OtpAttempts = ? WHERE Id = ?`,
    Number(nextAttempts) || 0,
    Number(id),
  );
}

export async function markExpired(id) {
  const prisma = getPrisma();
  await prisma.$executeRawUnsafe(
    `UPDATE ${TABLE} SET Status = ?, ProcessedAt = ? WHERE Id = ?`,
    PROFILE_CHANGE_STATUS_EXPIRED,
    asDate(nowUtc()),
    Number(id),
  );
}

export async function markApproved(id) {
  const prisma = getPrisma();
  await prisma.$executeRawUnsafe(
    `UPDATE ${TABLE} SET Status = ?, ProcessedAt = ? WHERE Id = ?`,
    PROFILE_CHANGE_STATUS_APPROVED,
    asDate(nowUtc()),
    Number(id),
  );
}
