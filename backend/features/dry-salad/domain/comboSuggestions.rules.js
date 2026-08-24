/**
 * Rank a user's usual dry-salad combo for one time slot.
 * Pure domain; no I/O.
 */
import { normalizeDrySaladSlot } from './timeSlots.rules.js';

export const DRY_SALAD_MEAL_KIND = 'dry-salad';
export const DEFAULT_COMBO_LOOKBACK = 150;
export const DEFAULT_OFTEN_LIMIT = 8;

/**
 * @param {unknown} name
 * @returns {string}
 */
export function normalizeItemKey(name) {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/**
 * @param {unknown} name
 * @returns {string}
 */
export function displayItemName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ');
}

/**
 * Index catalog rows by canonical name, normalized name, and aliases.
 * @param {object[]} rows
 * @returns {{ keys: Set<string>, byKey: Map<string, object> }}
 */
export function buildCatalogIndex(rows) {
  const keys = new Set();
  const byKey = new Map();
  for (const row of rows || []) {
    const names = [
      row?.canonical_name,
      row?.normalized_name,
      ...(Array.isArray(row?.aliases) ? row.aliases : []),
    ];
    for (const n of names) {
      const key = normalizeItemKey(n);
      if (!key) continue;
      keys.add(key);
      if (!byKey.has(key)) byKey.set(key, row);
    }
  }
  return { keys, byKey };
}

/**
 * @param {object|string|null|undefined} raw
 * @returns {object|null}
 */
export function parseAnalysisData(raw) {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }
  return typeof raw === 'object' ? raw : null;
}

/**
 * Slot stamped on the meal at save (device clock). Preferred over CreatedAt.
 * @param {object|string|null|undefined} analysisData
 * @returns {string|null}
 */
export function intakeSlotFromAnalysis(analysisData) {
  const data = parseAnalysisData(analysisData);
  return normalizeDrySaladSlot(data?.intakeSlot);
}

/**
 * Catalog-matching foods from a meal. Tagged dry-salad meals keep every food.
 * @param {object|string|null|undefined} analysisData
 * @param {Set<string>} catalogKeys
 * @returns {{ name: string, key: string, food: object }[]}
 */
export function extractDrySaladFoods(analysisData, catalogKeys) {
  const data = parseAnalysisData(analysisData);
  if (!data) return [];
  const tagged = data.mealKind === DRY_SALAD_MEAL_KIND;
  const foods = Array.isArray(data.foods) ? data.foods : [];
  const out = [];
  const seen = new Set();
  const keys = catalogKeys instanceof Set ? catalogKeys : new Set();

  for (const f of foods) {
    const display = displayItemName(f?.name || f?.foodName || '');
    const key = normalizeItemKey(display);
    if (!key || seen.has(key)) continue;
    if (!tagged && !keys.has(key)) continue;
    seen.add(key);
    out.push({ name: display, key, food: f && typeof f === 'object' ? f : {} });
  }
  return out;
}

/**
 * Stable combo identity: sorted normalized names.
 * @param {{ key: string }[]} foods
 * @returns {string}
 */
export function comboKeyFromFoods(foods) {
  return (foods || [])
    .map((f) => f.key)
    .filter(Boolean)
    .sort()
    .join('|');
}

/**
 * Most frequent combo; ties keep the first (newest-first) occurrence.
 * @param {{ foods: { name: string, key: string, food: object }[] }[]} intakes
 * @returns {{ items: { name: string, key: string, food: object }[], count: number, comboKey: string }}
 */
export function pickUsualCombo(intakes) {
  const groups = new Map();
  for (const intake of intakes || []) {
    const foods = Array.isArray(intake?.foods) ? intake.foods : [];
    if (foods.length === 0) continue;
    const key = comboKeyFromFoods(foods);
    if (!key) continue;
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      groups.set(key, { items: foods, count: 1, comboKey: key });
    }
  }

  let best = null;
  for (const group of groups.values()) {
    if (!best || group.count > best.count) best = group;
  }
  return best || { items: [], count: 0, comboKey: '' };
}

/**
 * Frequent slot items that are not already in the usual combo.
 * Newest-first intakes: first sighting keeps display/nutrition.
 * @param {{ foods: { name: string, key: string, food: object }[] }[]} intakes
 * @param {Set<string>|string[]} excludeKeys
 * @param {number} [limit]
 * @returns {{ name: string, key: string, food: object, score: number }[]}
 */
export function collectOftenItems(intakes, excludeKeys, limit = DEFAULT_OFTEN_LIMIT) {
  const exclude = excludeKeys instanceof Set
    ? excludeKeys
    : new Set((excludeKeys || []).map(normalizeItemKey));
  const counts = new Map();
  const latest = new Map();

  for (const intake of intakes || []) {
    for (const food of intake?.foods || []) {
      const key = food?.key;
      if (!key || exclude.has(key)) continue;
      counts.set(key, (counts.get(key) || 0) + 1);
      if (!latest.has(key)) latest.set(key, food);
    }
  }

  const cap = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : DEFAULT_OFTEN_LIMIT;
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, cap)
    .map(([key, score]) => ({ ...latest.get(key), score }));
}
