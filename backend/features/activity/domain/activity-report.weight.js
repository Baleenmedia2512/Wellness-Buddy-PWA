/**
 * Pure weight-delta helpers for Activity Report detail rows.
 * previousWeight = latest earlier log for the same member (prior day or earlier same day).
 */

/**
 * @param {{ Weight?: number|string|null }|null|undefined} row
 * @returns {number|null}
 */
export function parseActivityReportWeightKg(row) {
  if (row?.Weight === null || row?.Weight === undefined || row?.Weight === '') return null;
  const n = Number.parseFloat(row.Weight);
  return Number.isFinite(n) ? n : null;
}

/**
 * Group weight rows by user and sort CreatedAt ascending.
 * @param {Array<{ UserId?: number|string, Weight?: number|string|null, CreatedAt?: string }>|null|undefined} rows
 * @returns {Map<string, Array<{ UserId?: number|string, Weight?: number|string|null, CreatedAt?: string }>>}
 */
export function buildUserWeightRowsAsc(rows) {
  /** @type {Map<string, Array<{ UserId?: number|string, Weight?: number|string|null, CreatedAt?: string }>>} */
  const byUser = new Map();
  for (const row of rows || []) {
    if (!row || row.UserId == null) continue;
    const key = String(row.UserId);
    const list = byUser.get(key);
    if (list) list.push(row);
    else byUser.set(key, [row]);
  }
  for (const list of byUser.values()) {
    list.sort((a, b) => String(a.CreatedAt || '').localeCompare(String(b.CreatedAt || '')));
  }
  return byUser;
}

/**
 * Prepend prior-weight rows (already one latest-before-range per user) so
 * resolvePreviousWeightKg can see them.
 * @param {Map<string, Array<object>>} byUser
 * @param {Array<{ UserId?: number|string, Weight?: number|string|null, CreatedAt?: string }>|null|undefined} priorRows
 */
export function mergePriorWeightRows(byUser, priorRows) {
  for (const row of priorRows || []) {
    if (!row || row.UserId == null) continue;
    const key = String(row.UserId);
    const list = byUser.get(key) || [];
    // Keep ASC order: prior is always older than in-range rows.
    byUser.set(key, [row, ...list]);
  }
}

/**
 * Latest finite weight strictly before `createdAt` for one member's ASC list.
 * @param {string|null|undefined} createdAt
 * @param {Array<{ Weight?: number|string|null, CreatedAt?: string }>|null|undefined} userRowsAsc
 * @returns {number|null}
 */
export function resolvePreviousWeightKg(createdAt, userRowsAsc) {
  if (!createdAt || !Array.isArray(userRowsAsc) || userRowsAsc.length === 0) return null;
  const at = String(createdAt);
  let previous = null;
  for (const row of userRowsAsc) {
    if (String(row?.CreatedAt || '') >= at) break;
    const kg = parseActivityReportWeightKg(row);
    if (kg != null) previous = kg;
  }
  return previous;
}

/**
 * User IDs whose first in-range / deduped row has no prior weight in `byUser`.
 * @param {Array<{ UserId?: number|string, CreatedAt?: string }>|null|undefined} records
 * @param {Map<string, Array<object>>} byUser
 * @returns {number[]}
 */
export function collectUserIdsMissingPreviousWeight(records, byUser) {
  const missing = new Set();
  for (const record of records || []) {
    if (!record || record.UserId == null) continue;
    const key = String(record.UserId);
    const prev = resolvePreviousWeightKg(record.CreatedAt, byUser.get(key));
    if (prev == null) {
      const n = Number(record.UserId);
      if (Number.isFinite(n)) missing.add(n);
    }
  }
  return [...missing];
}
