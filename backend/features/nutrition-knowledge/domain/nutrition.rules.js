/**
 * backend/features/nutrition-knowledge/domain/nutrition.rules.js
 * Pure helpers for master nutrition lookup / scaling / candidate promotion.
 */
export const NUTRITION_KEYS = Object.freeze([
  'calories', 'protein', 'carbs', 'fat', 'fiber',
  'sugar', 'sodium', 'cholesterol', 'glycemic_index',
  'vitamin_a', 'vitamin_c', 'vitamin_d', 'vitamin_e', 'vitamin_k',
  'vitamin_b1', 'vitamin_b2', 'vitamin_b3', 'vitamin_b6', 'vitamin_b9', 'vitamin_b12',
  'calcium', 'iron', 'magnesium', 'potassium', 'zinc', 'phosphorus',
]);

/** Minimum sightings before a draft candidate may auto-promote to approved. */
export const AUTO_PROMOTE_SIGHTINGS = 5;

/**
 * Normalize a food name for exact master / alias matching.
 * @param {unknown} name
 * @returns {string}
 */
export function normalizeFoodName(name) {
  return String(name ?? '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{N}\s.-]/gu, '');
}

/**
 * Levenshtein edit distance for short food-name typo tolerance.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function editDistance(a, b) {
  const s = String(a || '');
  const t = String(b || '');
  if (s === t) return 0;
  if (!s.length) return t.length;
  if (!t.length) return s.length;
  const rows = s.length + 1;
  const cols = t.length + 1;
  const prev = new Array(cols);
  const cur = new Array(cols);
  for (let j = 0; j < cols; j += 1) prev[j] = j;
  for (let i = 1; i < rows; i += 1) {
    cur[0] = i;
    const sc = s.charCodeAt(i - 1);
    for (let j = 1; j < cols; j += 1) {
      const cost = sc === t.charCodeAt(j - 1) ? 0 : 1;
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j < cols; j += 1) prev[j] = cur[j];
  }
  return prev[t.length];
}

function maxTypoEdits(queryLen) {
  if (queryLen >= 6) return 2;
  if (queryLen >= 3) return 1;
  return 0;
}

/**
 * Whether a food name (and optional aliases) should appear as a typeahead hit.
 * Matches substring, word/name prefix, or small edit distance (typos).
 *
 * @param {unknown} name
 * @param {unknown} query
 * @param {string[]} [aliases]
 * @returns {boolean}
 */
export function foodNameMatchesQuery(name, query, aliases = []) {
  const q = normalizeFoodName(query);
  if (!q) return false;

  const candidates = [
    normalizeFoodName(name),
    ...(Array.isArray(aliases) ? aliases : []).map((a) => normalizeFoodName(a)),
  ].filter(Boolean);

  const maxEdits = maxTypoEdits(q.length);

  for (const n of candidates) {
    if (n.includes(q) || q.includes(n)) return true;
    if (n.startsWith(q)) return true;
    const words = n.split(/\s+/).filter(Boolean);
    if (words.some((w) => w.startsWith(q))) return true;
    if (maxEdits > 0 && editDistance(n, q) <= maxEdits) return true;
    if (maxEdits > 0 && words.some((w) => w.length >= 3 && editDistance(w, q) <= maxEdits)) {
      return true;
    }
  }
  return false;
}

/**
 * Rank key for typeahead: earlier character index of `query` in the name wins.
 * "o" → Onion (0) before Boiled (1) before Beetroot (4).
 * Typo-only hits sort after all substring hits.
 *
 * @param {unknown} name
 * @param {unknown} query
 * @param {string[]} [aliases]
 * @returns {number}
 */
export function foodNameMatchIndex(name, query, aliases = []) {
  const q = normalizeFoodName(query);
  if (!q) return Number.POSITIVE_INFINITY;

  const candidates = [
    normalizeFoodName(name),
    ...(Array.isArray(aliases) ? aliases : []).map((a) => normalizeFoodName(a)),
  ].filter(Boolean);

  let best = Number.POSITIVE_INFINITY;
  for (const n of candidates) {
    const idx = n.indexOf(q);
    if (idx >= 0) best = Math.min(best, idx);
  }

  if (best !== Number.POSITIVE_INFINITY) return best;

  // Matched only via typo / edit-distance — keep after substring hits.
  if (foodNameMatchesQuery(name, query, aliases)) {
    let dist = 99;
    const maxEdits = maxTypoEdits(q.length);
    if (maxEdits > 0) {
      for (const n of candidates) {
        dist = Math.min(dist, editDistance(n, q));
        for (const word of n.split(/\s+/).filter(Boolean)) {
          if (word.length >= 3) dist = Math.min(dist, editDistance(word, q));
        }
      }
    }
    return 10_000 + dist;
  }

  return Number.POSITIVE_INFINITY;
}

/**
 * Sort search hits: match position ascending, then name A→Z.
 * Accepts items with `name` and/or `canonical_name` (+ optional `aliases`).
 *
 * @param {object[]} items
 * @param {unknown} query
 * @returns {object[]}
 */
export function sortByFoodNameMatch(items, query) {
  if (!Array.isArray(items) || items.length < 2) return items || [];
  return items.slice().sort((a, b) => {
    const nameA = a?.name ?? a?.canonical_name ?? '';
    const nameB = b?.name ?? b?.canonical_name ?? '';
    const ia = foodNameMatchIndex(nameA, query, a?.aliases);
    const ib = foodNameMatchIndex(nameB, query, b?.aliases);
    if (ia !== ib) return ia - ib;
    return normalizeFoodName(nameA).localeCompare(normalizeFoodName(nameB));
  });
}

/**
 * Pick numeric nutrition fields from an arbitrary object.
 * @param {object|null|undefined} raw
 * @returns {Record<string, number>}
 */
export function pickNutrition(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const key of NUTRITION_KEYS) {
    const v = raw[key];
    if (v == null || v === '') continue;
    const n = Number(v);
    if (Number.isFinite(n)) out[key] = n;
  }
  return out;
}

/**
 * Scale nutrition linearly by weight ratio.
 * @param {Record<string, number>} nutrition
 * @param {number} referenceWeightG
 * @param {number} targetWeightG
 * @returns {Record<string, number>}
 */
export function scaleNutrition(nutrition, referenceWeightG, targetWeightG) {
  const ref = Number(referenceWeightG);
  const target = Number(targetWeightG);
  if (!(ref > 0) || !(target >= 0) || !nutrition || typeof nutrition !== 'object') {
    return pickNutrition(nutrition);
  }
  const ratio = target / ref;
  const out = {};
  for (const key of NUTRITION_KEYS) {
    if (nutrition[key] == null) continue;
    const n = Number(nutrition[key]);
    if (!Number.isFinite(n)) continue;
    out[key] = Math.round(n * ratio * 100) / 100;
  }
  return out;
}

/**
 * Build a search/resolve item from a master profile row (optionally scaled).
 * @param {object} row
 * @param {number} [targetWeightG]
 */
export function profileToSearchItem(row, targetWeightG = null) {
  const refW = Number(row.reference_weight_g) > 0 ? Number(row.reference_weight_g) : 100;
  const weight = targetWeightG != null && Number(targetWeightG) > 0
    ? Number(targetWeightG)
    : refW;
  const nutrition = scaleNutrition(pickNutrition(row.nutrition), refW, weight);
  return {
    name: row.canonical_name,
    weight_g: Math.round(weight),
    source: 'master',
    profileId: row.id ?? null,
    is_liquid: Boolean(row.is_liquid),
    portion: row.portion_label || `${Math.round(weight)}g`,
    ...nutrition,
    nutrition,
  };
}

/**
 * Whether a draft candidate should become approved.
 * @param {{ status: string, sightings: number }} row
 * @param {number} [threshold]
 */
export function shouldAutoPromote(row, threshold = AUTO_PROMOTE_SIGHTINGS) {
  if (!row || row.status !== 'draft') return false;
  return Number(row.sightings) >= threshold;
}

/**
 * Merge search lists with priority: master > my history > community.
 * First occurrence of a normalized name wins.
 * @param {{ masterItems?: object[], myItems?: object[], communityItems?: object[] }} parts
 */
export function mergeSearchResults({ masterItems = [], myItems = [], communityItems = [] }) {
  const seen = new Set();
  const out = [];
  for (const list of [masterItems, myItems, communityItems]) {
    for (const item of list) {
      const key = normalizeFoodName(item?.name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(item);
    }
  }
  return out;
}
