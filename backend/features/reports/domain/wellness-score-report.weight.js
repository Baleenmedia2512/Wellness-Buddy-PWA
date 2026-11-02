/**
 * Pure weight-delta helpers for Wellness Score Report (shared server/client rules).
 */

/**
 * todayWeight − previousWeight in kg, or null when either value is missing.
 * @param {number|null|undefined} todayWeight
 * @param {number|null|undefined} previousWeight
 * @returns {number|null}
 */
export function computeWeightDifferenceKg(todayWeight, previousWeight) {
  const today = todayWeight != null ? Number(todayWeight) : NaN;
  const prev = previousWeight != null ? Number(previousWeight) : NaN;
  if (!Number.isFinite(today) || !Number.isFinite(prev)) return null;
  return Number((today - prev).toFixed(3));
}

/**
 * Format a kg delta for UI / Excel: grams below 1 kg, else kg with 2 decimals.
 * @param {number|null|undefined} differenceKg
 * @returns {{ direction: 'down'|'up'|'same'|'none', changeLabel: string }}
 */
export function formatWeightDifference(differenceKg) {
  if (differenceKg == null || !Number.isFinite(Number(differenceKg))) {
    return { direction: 'none', changeLabel: '—' };
  }
  const delta = Number(differenceKg);
  if (Math.abs(delta) < 0.0005) {
    return { direction: 'same', changeLabel: '—' };
  }
  const abs = Math.abs(delta);
  const direction = delta < 0 ? 'down' : 'up';
  const changeLabel = abs < 1
    ? `${Math.round(abs * 1000)} g`
    : `${abs.toFixed(2)} kg`;
  return { direction, changeLabel };
}

/**
 * Extract YYYY-MM-DD from a legacy IST wall-clock CreatedAt (or ISO prefix).
 * @param {string|null|undefined} createdAt
 * @returns {string|null}
 */
export function weightCreatedAtToYmd(createdAt) {
  if (createdAt == null || createdAt === '') return null;
  const match = String(createdAt).match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

/**
 * Parse a weight row into a finite kg value (or null).
 * @param {{ Weight?: number|null }} row
 * @returns {number|null}
 */
function parseWeightKg(row) {
  if (row?.Weight === null || row?.Weight === undefined) return null;
  const n = Number.parseFloat(row.Weight);
  return Number.isFinite(n) ? n : null;
}

/**
 * Classify weight rows for a selected score date.
 *
 * Rows must be ordered CreatedAt DESC and already bounded to ≤ end of scoreDate.
 * - todayWeight: latest entry logged ON scoreDate exactly (null if none that day)
 * - previousWeight: next-latest entry before that (earlier same day or prior day)
 *
 * When scoreDateYmd is null/empty, falls back to latest two overall.
 *
 * @param {Array<{ UserId?: number, Weight?: number|null, CreatedAt?: string }>|null|undefined} rows
 * @param {string|null|undefined} scoreDateYmd YYYY-MM-DD
 * @returns {{ todayWeight: number|null, previousWeight: number|null, lastUpdated: string|null }}
 */
export function classifyWeightsForScoreDate(rows, scoreDateYmd) {
  const list = Array.isArray(rows) ? rows : [];
  const asOf =
    typeof scoreDateYmd === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(scoreDateYmd)
      ? scoreDateYmd
      : null;

  if (!asOf) {
    let todayWeight = null;
    let previousWeight = null;
    let lastUpdated = null;
    for (const row of list) {
      const parsed = parseWeightKg(row);
      if (todayWeight == null) {
        todayWeight = parsed;
        lastUpdated = row?.CreatedAt ?? null;
        continue;
      }
      if (previousWeight == null && parsed != null) {
        previousWeight = parsed;
        break;
      }
    }
    return { todayWeight, previousWeight, lastUpdated };
  }

  let todayWeight = null;
  let previousWeight = null;
  let lastUpdated = null;

  for (const row of list) {
    const ymd = weightCreatedAtToYmd(row?.CreatedAt);
    if (!ymd) continue;
    const parsed = parseWeightKg(row);

    if (ymd === asOf) {
      if (todayWeight == null) {
        todayWeight = parsed;
        lastUpdated = row?.CreatedAt ?? null;
      } else if (previousWeight == null && parsed != null) {
        previousWeight = parsed;
        break;
      }
      continue;
    }

    if (ymd < asOf) {
      // Older than selected day — only usable as previous when the day has a log.
      if (todayWeight != null && previousWeight == null && parsed != null) {
        previousWeight = parsed;
      }
      break;
    }
  }

  return { todayWeight, previousWeight, lastUpdated };
}
