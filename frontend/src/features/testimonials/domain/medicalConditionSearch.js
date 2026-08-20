/**
 * medicalConditionSearch.js
 *
 * Search, rank, recent-selection, and custom-issue helpers for medical conditions.
 * Custom labels (not in the built-in catalog) are remembered on this device
 * so they appear in later suggestion searches.
 * Swap ALL_MEDICAL_CONDITIONS for an API response in future without UI changes.
 */

import storage from '../../../shared/lib/storage.js';
import {
  ALL_MEDICAL_CONDITIONS,
  POPULAR_MEDICAL_CONDITIONS,
} from '../data/medicalConditions.js';
import { uniqueConditions } from '../utils/uniqueConditions.js';

const RECENT_STORAGE_KEY = 'testimonials.recentMedicalConditions';
const CUSTOM_STORAGE_KEY = 'testimonials.customMedicalConditions';
const MAX_RECENT = 8;
const MAX_CUSTOM = 50;
const VISIBLE_SUGGESTION_CAP = 8;

/**
 * @param {string} name
 * @param {string} query
 */
export function conditionMatchesQuery(name, query) {
  const q = query.trim().toLowerCase();
  if (!q) return false;

  const lower = name.toLowerCase();
  if (lower.includes(q)) return true;

  return lower.split(/[\s\-/(),]+/).some((word) => word.includes(q));
}

/**
 * @param {string} name
 * @param {string} query
 * @param {Set<string>} recentSet
 */
function scoreCondition(name, query, recentSet) {
  const q = query.trim().toLowerCase();
  const lower = name.toLowerCase();
  let score = 0;

  if (recentSet.has(name)) score += 1000;
  if (POPULAR_MEDICAL_CONDITIONS.has(name)) score += 100;

  if (lower.startsWith(q)) {
    score += 50;
  } else if (lower.split(/[\s\-/(),]+/).some((word) => word.startsWith(q))) {
    score += 30;
  }

  const idx = lower.indexOf(q);
  if (idx >= 0) score += Math.max(0, 20 - idx);

  return score;
}

/**
 * @returns {string[]}
 */
export function getRecentMedicalConditions() {
  return uniqueConditions(readStoredLabels(RECENT_STORAGE_KEY));
}

function readStoredLabels(key) {
  try {
    const raw = storage.get(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item) => typeof item === 'string' && item.trim())
      : [];
  } catch {
    return [];
  }
}

function isBuiltInCondition(name) {
  const key = String(name || '').trim().toLowerCase();
  if (!key) return false;
  return ALL_MEDICAL_CONDITIONS.some((item) => item.toLowerCase() === key);
}

/**
 * Custom labels added by the user that are not in the built-in catalog.
 * Shown in later suggestion searches on this device.
 * @returns {string[]}
 */
export function getCustomMedicalConditions() {
  return uniqueConditions(readStoredLabels(CUSTOM_STORAGE_KEY));
}

/**
 * Persist a custom health issue so it appears in later suggestion searches.
 * Built-in catalog names are ignored.
 * @param {string} condition
 */
export function recordCustomMedicalCondition(condition) {
  const trimmed = (condition ?? '').trim();
  if (!trimmed || isBuiltInCondition(trimmed)) return;

  const existing = getCustomMedicalConditions().filter(
    (item) => item.toLowerCase() !== trimmed.toLowerCase(),
  );
  storage.set(CUSTOM_STORAGE_KEY, JSON.stringify([trimmed, ...existing].slice(0, MAX_CUSTOM)));
}

/**
 * @param {string} condition
 */
export function recordRecentMedicalCondition(condition) {
  const trimmed = (condition ?? '').trim();
  if (!trimmed) return;

  const recent = getRecentMedicalConditions().filter((item) => item !== trimmed);
  const updated = [trimmed, ...recent].slice(0, MAX_RECENT);
  storage.set(RECENT_STORAGE_KEY, JSON.stringify(updated));
  recordCustomMedicalCondition(trimmed);
}

/**
 * @param {string} query
 * @param {{
 *   conditions?: string[],
 *   recentSelections?: string[],
 *   customConditions?: string[],
 * }} [options]
 * @returns {string[]}
 */
export function searchMedicalConditions(query, options = {}) {
  const q = query.trim();
  if (!q) return [];

  const recent = options.recentSelections ?? getRecentMedicalConditions();
  const custom = options.customConditions ?? getCustomMedicalConditions();
  const conditions = uniqueConditions([
    ...(options.conditions ?? ALL_MEDICAL_CONDITIONS),
    ...custom,
    ...recent,
  ]);
  const recentSet = new Set(recent);

  return conditions
    .filter((name) => conditionMatchesQuery(name, q))
    .sort((a, b) => {
      const scoreDiff = scoreCondition(b, q, recentSet) - scoreCondition(a, q, recentSet);
      if (scoreDiff !== 0) return scoreDiff;
      return a.localeCompare(b);
    });
}

export { VISIBLE_SUGGESTION_CAP };
