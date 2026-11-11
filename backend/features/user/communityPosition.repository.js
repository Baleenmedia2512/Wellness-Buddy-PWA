/**
 * Community Position catalog + pending coach OTP requests.
 */
import { getMysqlClient } from '../../utils/mysqlClient.js';
import { nowUtc } from '../../shared/lib/datetime/index.js';
import { POSITION_STATUS_CANCELLED, POSITION_STATUS_EXPIRED, POSITION_STATUS_PENDING } from './domain/communityPosition.rules.js';

const POSITIONS = 'community_positions_table';
const REQUESTS = 'community_position_requests_table';

function isMissing(error, table) {
  const msg = String(error?.message || error || '');
  return new RegExp(table, 'i').test(msg)
    && /does not exist|not find|schema cache|relation|Unknown table|1146/i.test(msg);
}

export function isPositionsTableMissing(error) {
  return isMissing(error, POSITIONS);
}

export function isPositionRequestsTableMissing(error) {
  return isMissing(error, REQUESTS);
}

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

export async function listPositions({ activeOnly = false } = {}) {
  const db = getMysqlClient();
  let query = db.from(POSITIONS).select(POSITION_COLS).order('SortOrder', { ascending: true });
  if (activeOnly) query = query.eq('IsActive', true);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function findPositionByCode(code) {
  const value = String(code || '').trim();
  if (!value) return null;
  const db = getMysqlClient();
  const { data, error } = await db
    .from(POSITIONS)
    .select(POSITION_COLS)
    .eq('Code', value)
    .limit(1);
  if (error) throw error;
  return data?.[0] || null;
}

export async function findPositionByFeatureKey(featureKey, excludeCode = null) {
  const key = String(featureKey || '').trim();
  if (!key) return null;
  const db = getMysqlClient();
  const { data, error } = await db
    .from(POSITIONS)
    .select(POSITION_COLS)
    .eq('FeatureKey', key)
    .limit(5);
  if (error) throw error;
  const skip = excludeCode ? String(excludeCode).trim() : '';
  return (data || []).find((row) => String(row.Code) !== skip) || null;
}

export async function insertPosition(row) {
  const db = getMysqlClient();
  const { data, error } = await db.from(POSITIONS).insert([row]).select(POSITION_COLS);
  if (error) throw error;
  return data?.[0] || null;
}

export async function updatePositionByCode(code, patch) {
  const db = getMysqlClient();
  const { data, error } = await db
    .from(POSITIONS)
    .update(patch)
    .eq('Code', code)
    .select(POSITION_COLS);
  if (error) throw error;
  return data?.[0] || null;
}

export async function findPendingByRequesterId(requesterId) {
  const uid = Number(requesterId);
  if (!Number.isFinite(uid)) return null;
  const db = getMysqlClient();
  const { data, error } = await db
    .from(REQUESTS)
    .select(REQUEST_COLS)
    .eq('RequesterId', uid)
    .eq('Status', POSITION_STATUS_PENDING)
    .order('RequestedAt', { ascending: false })
    .limit(1);
  if (error) throw error;
  return data?.[0] || null;
}

export async function cancelPendingByRequesterId(requesterId) {
  const uid = Number(requesterId);
  if (!Number.isFinite(uid)) return;
  const db = getMysqlClient();
  const { error } = await db
    .from(REQUESTS)
    .update({
      Status: POSITION_STATUS_CANCELLED,
      ProcessedAt: nowUtc(),
    })
    .eq('RequesterId', uid)
    .eq('Status', POSITION_STATUS_PENDING);
  if (error) throw error;
}

export async function insertRequest(row) {
  const db = getMysqlClient();
  const { data, error } = await db.from(REQUESTS).insert([row]).select(REQUEST_COLS);
  if (error) throw error;
  return data?.[0] || null;
}

export async function incrementOtpAttempts(id, nextAttempts) {
  const db = getMysqlClient();
  const { error } = await db.from(REQUESTS).update({ OtpAttempts: nextAttempts }).eq('Id', id);
  if (error) throw error;
}

export async function markExpired(id) {
  const db = getMysqlClient();
  const { error } = await db
    .from(REQUESTS)
    .update({ Status: POSITION_STATUS_EXPIRED, ProcessedAt: nowUtc() })
    .eq('Id', id);
  if (error) throw error;
}

export async function markApproved(id) {
  const db = getMysqlClient();
  const { error } = await db
    .from(REQUESTS)
    .update({ Status: 'approved', ProcessedAt: nowUtc() })
    .eq('Id', id);
  if (error) throw error;
}
