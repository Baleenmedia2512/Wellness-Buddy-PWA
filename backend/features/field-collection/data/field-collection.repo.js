import { getPrisma } from '../../../shared/lib/prisma.js';
import logger from '../../../shared/lib/logger.js';

function missingTable(error) {
  const message = String(error?.message || error || '');
  const code = String(error?.meta?.code || error?.code || '');
  return code === '1146' || /doesn't exist|does not exist|unknown table/i.test(message);
}

function sqlId(value) {
  if (typeof value === 'bigint') return value.toString();
  return value;
}

function toDate(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function plainValue(value) {
  if (typeof value === 'bigint') {
    const asNumber = Number(value);
    return Number.isSafeInteger(asNumber) ? asNumber : value.toString();
  }
  if (value instanceof Date) return value.toISOString();
  return value;
}

function plainRow(row) {
  const out = {};
  for (const [key, value] of Object.entries(row || {})) {
    out[key] = key === 'fields' ? parseJson(value) : plainValue(value);
  }
  return out;
}

function parseJson(value) {
  if (value == null) return null;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

async function withUtc(fn) {
  const prisma = getPrisma();
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET time_zone = '+00:00'");
    return fn(tx);
  });
}

export async function getLatestPolicy() {
  try {
    const rows = await withUtc((tx) => tx.$queryRawUnsafe(
      `SELECT id, fields, updated_at, updated_by_user_id
       FROM field_collection_policy_table
       ORDER BY id DESC
       LIMIT 1`,
    ));
    const row = rows?.[0];
    if (!row) return null;
    return plainRow(row);
  } catch (error) {
    if (missingTable(error)) return null;
    logger.error('[field-collection.repo] policy fetch failed', { err: error.message });
    throw error;
  }
}

export async function insertPolicy({ fields, updatedByUserId }) {
  try {
    await withUtc((tx) => tx.$executeRawUnsafe(
      `INSERT INTO field_collection_policy_table (fields, updated_by_user_id)
       VALUES (?, ?)`,
      JSON.stringify(fields ?? []),
      updatedByUserId == null ? null : sqlId(updatedByUserId),
    ));
    return getLatestPolicy();
  } catch (error) {
    if (missingTable(error)) {
      const err = new Error('Field collection storage is not ready. Run the field collection migration.');
      err.status = 503;
      throw err;
    }
    throw error;
  }
}

export async function listPromptState(userId) {
  try {
    const rows = await withUtc((tx) => tx.$queryRawUnsafe(
      `SELECT field_key, skip_count, cycle_started_at, last_filled_at, last_skipped_at
       FROM field_collection_prompt_state_table
       WHERE user_id = ?`,
      sqlId(userId),
    ));
    return (rows || []).map(plainRow);
  } catch (error) {
    if (missingTable(error)) return [];
    logger.error('[field-collection.repo] state fetch failed', { err: error.message });
    throw error;
  }
}

async function writeState(userId, fieldKey, patch) {
  const columns = ['user_id', 'field_key'];
  const values = [sqlId(userId), fieldKey];
  const assignments = [];
  for (const [key, value] of Object.entries(patch)) {
    columns.push(key);
    values.push(key.endsWith('_at') ? toDate(value) : value);
    assignments.push(`${key} = VALUES(${key})`);
  }
  const placeholders = columns.map(() => '?').join(', ');
  try {
    await withUtc((tx) => tx.$executeRawUnsafe(
      `INSERT INTO field_collection_prompt_state_table (${columns.join(', ')})
       VALUES (${placeholders})
       ON DUPLICATE KEY UPDATE ${assignments.join(', ')}`,
      ...values,
    ));
  } catch (error) {
    if (missingTable(error)) return null;
    throw error;
  }
  const rows = await listPromptState(userId);
  return rows.find((row) => row.field_key === fieldKey) || null;
}

export async function markCycleStart(userId, fieldKey, nowIso) {
  return writeState(userId, fieldKey, { cycle_started_at: nowIso });
}

export async function markFilled(userId, fieldKey, nowIso) {
  return writeState(userId, fieldKey, {
    skip_count: 0,
    cycle_started_at: null,
    last_filled_at: nowIso,
    last_skipped_at: null,
  });
}

export async function markSkipped(userId, fieldKey, nowIso, skipCount, cycleStartedAt) {
  return writeState(userId, fieldKey, {
    skip_count: skipCount,
    cycle_started_at: cycleStartedAt || nowIso,
    last_skipped_at: nowIso,
  });
}
