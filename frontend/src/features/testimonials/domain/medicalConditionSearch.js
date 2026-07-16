/**
 * medicalConditionSearch.js
 *
 * Search, rank, and recent-selection helpers for medical conditions.
 * Swap ALL_MEDICAL_CONDITIONS for an API response in future without UI changes.
 */

import storage from '../../../shared/lib/storage.js';
import {
  ALL_MEDICAL_CONDITIONS,
  POPULAR_MEDICAL_CONDITIONS,
} from '../data/medicalConditions.js';

const RECENT_STORAGE_KEY = 'testimonials.recentMedicalConditions';
const MAX_RECENT = 8;
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
  try {
    const raw = storage.get(RECENT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
  } catch {
    return [];
  }
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
}

/**
 * @param {string} query
 * @param {{
 *   conditions?: string[],
 *   recentSelections?: string[],
 * }} [options]
 * @returns {string[]}
 */
export function searchMedicalConditions(query, options = {}) {
  const q = query.trim();
  if (!q) return [];

  const conditions = options.conditions ?? ALL_MEDICAL_CONDITIONS;
  const recent = options.recentSelections ?? getRecentMedicalConditions();
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
