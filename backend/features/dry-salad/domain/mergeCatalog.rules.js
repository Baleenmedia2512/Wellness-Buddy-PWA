/**
 * Merge DB catalog rows with in-code brand seeds.
 * DB wins on the same normalized_name (ops can override).
 * Pure — zero I/O.
 */
import { normalizeFoodName } from '../../nutrition-knowledge/domain/nutrition.rules.js';

function rowKey(row) {
  return normalizeFoodName(row?.normalized_name || row?.canonical_name);
}

/**
 * @param {object[]|null|undefined} dbRows
 * @param {object[]|null|undefined} seedRows
 * @returns {object[]}
 */
export function mergeCatalogRows(dbRows, seedRows) {
  const db = Array.isArray(dbRows) ? dbRows : [];
  const seeds = Array.isArray(seedRows) ? seedRows : [];
  const byKey = new Map();

  for (const row of seeds) {
    const key = rowKey(row);
    if (!key) continue;
    byKey.set(key, row);
  }
  for (const row of db) {
    const key = rowKey(row);
    if (!key) continue;
    byKey.set(key, row);
  }

  return [...byKey.values()].sort((a, b) =>
    normalizeFoodName(a.canonical_name).localeCompare(normalizeFoodName(b.canonical_name)),
  );
}

/**
 * Cap a merged catalog while always keeping brand seed rows (Formula 1 / Afresh)
 * so they are not dropped when the browse limit is smaller than the full catalog.
 *
 * @param {object[]} merged
 * @param {object[]} seedRows
 * @param {number} limit
 * @returns {object[]}
 */
export function takeCatalogPage(merged, seedRows, limit) {
  const cap = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 0;
  const rows = Array.isArray(merged) ? merged : [];
  if (rows.length <= cap) return rows;

  const seedKeys = new Set(
    (Array.isArray(seedRows) ? seedRows : []).map(rowKey).filter(Boolean),
  );
  const mustKeep = rows.filter((row) => seedKeys.has(rowKey(row)));
  const rest = rows.filter((row) => !seedKeys.has(rowKey(row)));
  const room = Math.max(0, cap - mustKeep.length);
  return [...mustKeep, ...rest.slice(0, room)].sort((a, b) =>
    normalizeFoodName(a.canonical_name).localeCompare(normalizeFoodName(b.canonical_name)),
  );
}
