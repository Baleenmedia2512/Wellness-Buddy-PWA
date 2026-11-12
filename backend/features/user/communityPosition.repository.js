/**
 * Community Position catalog + pending coach OTP requests.
 * Raw SQL so the tables work before the Prisma client is regenerated.
 */
import { getPrisma } from '../../shared/lib/prisma.js';
import { nowUtc } from '../../shared/lib/datetime/index.js';
import { POSITION_STATUS_CANCELLED, POSITION_STATUS_EXPIRED, POSITION_STATUS_PENDING } from './domain/communityPosition.rules.js';

const POSITIONS = 'community_positions_table';
const REQUESTS = 'community_position_requests_table';

const POSITION_COLS = 'Id, Code, Label, FeatureKey, UsageNote, SortOrder, IsActive, CreatedAt';
const REQUEST_COLS = [
  'Id',
  'RequesterId',
  'ApproverId',
  'PositionCode',
  'OtpHash',
  'OtpExpiresAt',
  'OtpSentAt',
  'OtpAttempts',
  'Status',
  'RequestedAt',
].join(', ');

function isMissing(error, table) {
  const msg = String(error?.message || error || '');
  return new RegExp(table, 'i').test(msg)
    && /does not exist|doesn't exist|not find|schema cache|relation|Unknown table|1146/i.test(msg);
}

export function isPositionsTableMissing(error) {
  return isMissing(error, POSITIONS);
}

export function isPositionRequestsTableMissing(error) {
  return isMissing(error, REQUESTS);
}

function plainValue(value) {
  if (typeof value === 'bigint') return Number(value);
  if (value instanceof Date) return value.toISOString();
  return value;
}

function plainRow(row) {
  if (!row || typeof row !== 'object') return row;
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    if (key === 'IsActive') {
      out[key] = value === true || value === 1 || value === '1';
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

export async function listPositions({ activeOnly = false } = {}) {
  const where = activeOnly ? ' WHERE IsActive = 1' : '';
  return query(
    `SELECT ${POSITION_COLS} FROM ${POSITIONS}${where} ORDER BY SortOrder ASC, Id ASC`,
  );
}

export async function findPositionByCode(code) {
  const value = String(code || '').trim();
  if (!value) return null;
  const rows = await query(
    `SELECT ${POSITION_COLS} FROM ${POSITIONS} WHERE Code = ? LIMIT 1`,
    [value],
  );
  return rows[0] || null;
}

export async function findPositionByFeatureKey(featureKey, excludeCode = null) {
  const key = String(featureKey || '').trim();
  if (!key) return null;
  const rows = await query(
    `SELECT ${POSITION_COLS} FROM ${POSITIONS} WHERE FeatureKey = ? LIMIT 5`,
    [key],
  );
  const skip = excludeCode ? String(excludeCode).trim() : '';
  return rows.find((row) => String(row.Code) !== skip) || null;
}

export async function insertPosition(row) {
  const prisma = getPrisma();
  await prisma.$executeRawUnsafe(
    `INSERT INTO ${POSITIONS} (Code, Label, FeatureKey, UsageNote, SortOrder, IsActive)
     VALUES (?, ?, ?, ?, ?, ?)`,
    row.Code,
    row.Label,
    row.FeatureKey,
    row.UsageNote,
    Number(row.SortOrder) || 0,
    row.IsActive === false || row.IsActive === 0 ? 0 : 1,
  );
  return findPositionByCode(row.Code);
}

export async function updatePositionByCode(code, patch) {
  const sets = [];
  const params = [];
  const columns = ['Label', 'FeatureKey', 'UsageNote', 'SortOrder', 'IsActive'];
  for (const column of columns) {
    if (patch[column] === undefined) continue;
    sets.push(`${column} = ?`);
    params.push(column === 'IsActive'
      ? (patch[column] === false || patch[column] === 0 ? 0 : 1)
      : patch[column]);
  }
  if (sets.length === 0) return findPositionByCode(code);
  const prisma = getPrisma();
  await prisma.$executeRawUnsafe(
    `UPDATE ${POSITIONS} SET ${sets.join(', ')} WHERE Code = ?`,
    ...params,
    code,
  );
  return findPositionByCode(code);
}

export async function findPendingByRequesterId(requesterId) {
  const uid = Number(requesterId);
  if (!Number.isFinite(uid)) return null;
  const rows = await query(
    `SELECT ${REQUEST_COLS} FROM ${REQUESTS}
     WHERE RequesterId = ? AND Status = ?
     ORDER BY RequestedAt DESC
     LIMIT 1`,
    [uid, POSITION_STATUS_PENDING],
  );
  return rows[0] || null;
}

export async function cancelPendingByRequesterId(requesterId) {
  const uid = Number(requesterId);
  if (!Number.isFinite(uid)) return;
  const prisma = getPrisma();
  await prisma.$executeRawUnsafe(
    `UPDATE ${REQUESTS}
     SET Status = ?, ProcessedAt = ?
     WHERE RequesterId = ? AND Status = ?`,
    POSITION_STATUS_CANCELLED,
    asDate(nowUtc()),
    uid,
    POSITION_STATUS_PENDING,
  );
}

export async function insertRequest(row) {
  const prisma = getPrisma();
  await prisma.$executeRawUnsafe(
    `INSERT INTO ${REQUESTS}
      (RequesterId, ApproverId, PositionCode, OtpHash, OtpExpiresAt, OtpSentAt, OtpAttempts, Status, RequestedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    Number(row.RequesterId),
    Number(row.ApproverId),
    row.PositionCode,
    row.OtpHash,
    asDate(row.OtpExpiresAt),
    asDate(row.OtpSentAt),
    Number(row.OtpAttempts) || 0,
    row.Status || POSITION_STATUS_PENDING,
    asDate(row.RequestedAt) || asDate(nowUtc()),
  );
  return findPendingByRequesterId(row.RequesterId);
}

export async function incrementOtpAttempts(id, nextAttempts) {
  const prisma = getPrisma();
  await prisma.$executeRawUnsafe(
    `UPDATE ${REQUESTS} SET OtpAttempts = ? WHERE Id = ?`,
    Number(nextAttempts) || 0,
    Number(id),
  );
}

export async function markExpired(id) {
  const prisma = getPrisma();
  await prisma.$executeRawUnsafe(
    `UPDATE ${REQUESTS} SET Status = ?, ProcessedAt = ? WHERE Id = ?`,
    POSITION_STATUS_EXPIRED,
    asDate(nowUtc()),
    Number(id),
  );
}

export async function markApproved(id) {
  const prisma = getPrisma();
  await prisma.$executeRawUnsafe(
    `UPDATE ${REQUESTS} SET Status = ?, ProcessedAt = ? WHERE Id = ?`,
    'approved',
    asDate(nowUtc()),
    Number(id),
  );
}
