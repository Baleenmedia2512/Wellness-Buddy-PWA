/**
 * Pending unified profile-change OTP requests.
 */
import { getMysqlClient } from '../../utils/mysqlClient.js';
import { nowUtc } from '../../shared/lib/datetime/index.js';
import {
  PROFILE_CHANGE_STATUS_APPROVED,
  PROFILE_CHANGE_STATUS_CANCELLED,
  PROFILE_CHANGE_STATUS_EXPIRED,
  PROFILE_CHANGE_STATUS_PENDING,
} from './domain/profileChange.rules.js';

const TABLE = 'profile_change_requests_table';

function isMissingTable(error) {
  const msg = String(error?.message || error || '');
  return /profile_change_requests_table/i.test(msg)
    && /does not exist|not find|schema cache|relation|Unknown table|1146/i.test(msg);
}

export function isProfileChangeRequestsTableMissing(error) {
  return isMissingTable(error);
}

const PUBLIC_COLS = [
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

function parseJsonField(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
}

function normalizeRow(row) {
  if (!row) return null;
  return {
    ...row,
    PendingPayload: parseJsonField(row.PendingPayload, {}),
    ChangedKeys: (() => {
      const parsed = parseJsonField(row.ChangedKeys, []);
      return Array.isArray(parsed) ? parsed : [];
    })(),
  };
}

export async function findPendingByRequesterId(requesterId) {
  const uid = Number(requesterId);
  if (!Number.isFinite(uid)) return null;
  try {
    const db = getMysqlClient();
    const { data, error } = await db
      .from(TABLE)
      .select(PUBLIC_COLS)
      .eq('RequesterId', uid)
      .eq('Status', PROFILE_CHANGE_STATUS_PENDING)
      .order('RequestedAt', { ascending: false })
      .limit(1);
    if (error) throw error;
    return normalizeRow(data?.[0] || null);
  } catch (error) {
    if (isMissingTable(error)) return null;
    throw error;
  }
}

export async function cancelPendingByRequesterId(requesterId) {
  const uid = Number(requesterId);
  if (!Number.isFinite(uid)) return;
  try {
    const db = getMysqlClient();
    const { error } = await db
      .from(TABLE)
      .update({
        Status: PROFILE_CHANGE_STATUS_CANCELLED,
        ProcessedAt: nowUtc(),
      })
      .eq('RequesterId', uid)
      .eq('Status', PROFILE_CHANGE_STATUS_PENDING);
    if (error) throw error;
  } catch (error) {
    if (isMissingTable(error)) return;
    throw error;
  }
}

export async function insertRequest(row) {
  const db = getMysqlClient();
  const payload = {
    RequesterId: Number(row.RequesterId),
    ApproverId: Number(row.ApproverId),
    PendingPayload: typeof row.PendingPayload === 'string'
      ? row.PendingPayload
      : JSON.stringify(row.PendingPayload || {}),
    ChangedKeys: typeof row.ChangedKeys === 'string'
      ? row.ChangedKeys
      : JSON.stringify(Array.isArray(row.ChangedKeys) ? row.ChangedKeys : []),
    OtpHash: row.OtpHash,
    OtpExpiresAt: row.OtpExpiresAt,
    OtpSentAt: row.OtpSentAt || null,
    OtpAttempts: Number(row.OtpAttempts) || 0,
    Status: row.Status || PROFILE_CHANGE_STATUS_PENDING,
    RequestedAt: row.RequestedAt || nowUtc(),
  };
  const { data, error } = await db
    .from(TABLE)
    .insert([payload])
    .select(PUBLIC_COLS);
  if (error) throw error;
  return normalizeRow(data?.[0] || null);
}

export async function incrementOtpAttempts(id, nextAttempts) {
  const db = getMysqlClient();
  const { error } = await db
    .from(TABLE)
    .update({ OtpAttempts: nextAttempts })
    .eq('Id', id);
  if (error) throw error;
}

export async function markExpired(id) {
  const db = getMysqlClient();
  const { error } = await db
    .from(TABLE)
    .update({
      Status: PROFILE_CHANGE_STATUS_EXPIRED,
      ProcessedAt: nowUtc(),
    })
    .eq('Id', id);
  if (error) throw error;
}

export async function markApproved(id) {
  const db = getMysqlClient();
  const { error } = await db
    .from(TABLE)
    .update({
      Status: PROFILE_CHANGE_STATUS_APPROVED,
      ProcessedAt: nowUtc(),
    })
    .eq('Id', id);
  if (error) throw error;
}
