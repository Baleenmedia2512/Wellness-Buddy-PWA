/**
 * Dedupe recovered health-issue labels (case-insensitive, first spelling wins).
 * @param {unknown[]} items
 * @returns {string[]}
 */
export function uniqueConditions(items = []) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const label = String(item || '').trim();
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(label);
  }
  return result;
}

/** @param {unknown} label */
export function issueKey(label) {
  return String(label || '').trim().toLowerCase();
}

/**
 * @param {unknown[]} list
 * @param {unknown} label
 * @returns {boolean}
 */
export function hasHealthIssue(list, label) {
  const key = issueKey(label);
  if (!key) return false;
  return uniqueConditions(list).some((item) => issueKey(item) === key);
}

/**
 * @param {unknown[]} list
 * @param {unknown} label
 * @returns {string[]}
 */
export function withoutHealthIssue(list, label) {
  const key = issueKey(label);
  return uniqueConditions(list).filter((item) => issueKey(item) !== key);
}

/**
 * @param {unknown[]} a
 * @param {unknown[]} b
 * @returns {boolean}
 */
export function isSameIssueList(a, b) {
  const left = uniqueConditions(a);
  const right = uniqueConditions(b);
  if (left.length !== right.length) return false;
  const keys = new Set(left.map(issueKey));
  return right.every((item) => keys.has(issueKey(item)));
}

/**
 * Show "Add custom" when the typed label is not already selected
 * and is not an exact catalog suggestion.
 *
 * @param {unknown} query
 * @param {{ suggestions?: unknown[], selected?: unknown[] }} [opts]
 * @returns {boolean}
 */
export function canAddCustomHealthIssue(query, { suggestions = [], selected = [] } = {}) {
  const trimmed = String(query || '').trim();
  if (trimmed.length < 2) return false;
  const key = issueKey(trimmed);
  if (!key) return false;
  if (selected.some((item) => issueKey(item) === key)) return false;
  if (suggestions.some((item) => issueKey(item) === key)) return false;
  return true;
}
