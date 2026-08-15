/**
 * Weight delta + score display helpers for Wellness Score Report.
 * Prefers API `difference` when present; falls back to today/previous.
 */

/**
 * @param {number|null|undefined} todayWeight
 * @param {number|null|undefined} previousWeight
 * @param {number|null|undefined} [differenceFromApi]
 * @returns {{
 *   direction: 'down'|'up'|'same'|'none',
 *   deltaKg: number|null,
 *   changeLabel: string,
 *   comparisonLabel: string,
 * }}
 */
export function computeWeightChange(todayWeight, previousWeight, differenceFromApi) {
  const todayLabel = formatWeightKg(todayWeight);
  const prevLabel = formatWeightKg(previousWeight);
  const comparisonLabel =
    prevLabel && todayLabel
      ? `${prevLabel} → ${todayLabel}`
      : todayLabel || prevLabel || '—';

  let deltaKg = null;
  if (differenceFromApi != null && Number.isFinite(Number(differenceFromApi))) {
    deltaKg = Number(differenceFromApi);
  } else {
    const today = todayWeight != null ? Number(todayWeight) : NaN;
    const prev = previousWeight != null ? Number(previousWeight) : NaN;
    if (Number.isFinite(today) && Number.isFinite(prev)) {
      deltaKg = Number((today - prev).toFixed(3));
    }
  }

  if (deltaKg == null || !Number.isFinite(deltaKg)) {
    return {
      direction: 'none',
      deltaKg: null,
      changeLabel: '—',
      comparisonLabel,
    };
  }

  if (Math.abs(deltaKg) < 0.0005) {
    return {
      direction: 'same',
      deltaKg: 0,
      changeLabel: '—',
      comparisonLabel,
    };
  }

  const abs = Math.abs(deltaKg);
  const direction = deltaKg < 0 ? 'down' : 'up';
  const changeLabel = abs < 1
    ? `${Math.round(abs * 1000)} g`
    : `${abs.toFixed(2)} kg`;

  return { direction, deltaKg, changeLabel, comparisonLabel };
}

/**
 * @param {number|null|undefined} kg
 * @param {{ compact?: boolean }} [opts] compact — number only (mobile WT column)
 * @returns {string}
 */
export function formatWeightKg(kg, opts = {}) {
  if (kg == null || kg === '') return '';
  const n = Number(kg);
  if (!Number.isFinite(n)) return '';
  const value = n.toFixed(2);
  return opts.compact ? value : `${value} kg`;
}

/**
 * Split a display name onto two lines: first word, then the rest.
 * Single-token names stay on one line.
 *
 * @param {string|null|undefined} name
 * @returns {{ line1: string, line2: string|null }}
 */
export function formatReportNameLines(name) {
  const trimmed = String(name || '').trim().replace(/\s+/g, ' ');
  if (!trimmed) return { line1: '—', line2: null };
  const spaceIdx = trimmed.indexOf(' ');
  if (spaceIdx < 0) return { line1: trimmed, line2: null };
  return {
    line1: trimmed.slice(0, spaceIdx),
    line2: trimmed.slice(spaceIdx + 1),
  };
}

/**
 * Display total_earned points only (e.g. 660, 550).
 * @param {number|null|undefined} totalEarned
 * @returns {string}
 */
export function formatWellnessScore(totalEarned) {
  if (totalEarned == null || totalEarned === '') return '—';
  const n = Number(totalEarned);
  if (!Number.isFinite(n)) return '—';
  return String(Math.round(n));
}
