/**
 * diary/domain/share/weightShare.js
 * WhatsApp caption for weight diary entries with auto delta.
 */

/**
 * @param {{
 *   previousWeight?: number|null,
 *   currentWeight?: number|null,
 * }} input
 * @returns {string}
 */
export function buildWeightShareText({
  previousWeight = null,
  currentWeight = null,
} = {}) {
  const current = formatKg(currentWeight);
  const previous = formatKg(previousWeight);
  const lines = [
    '⚖️ Weight Update',
    '',
    `Before: ${previous != null ? `${previous} kg` : '—'}`,
    `After: ${current != null ? `${current} kg` : '—'}`,
  ];

  if (previous != null && current != null) {
    const delta = Math.round((current - previous) * 100) / 100;
    if (delta < 0) {
      lines.push('', `⬇️ ${formatDeltaChangeLabel('Decreased', Math.abs(delta))}`);
    } else if (delta > 0) {
      lines.push('', `⬆️ ${formatDeltaChangeLabel('Increased', Math.abs(delta))}`);
    } else {
      lines.push('', 'No change');
    }
  }

  return lines.join('\n');
}

/**
 * UI chrome for weight delta (green decrease / red increase).
 * Small day-to-day changes show in grams (e.g. "Increased by 150 g").
 * @param {number|null|undefined} previousWeight
 * @param {number|null|undefined} currentWeight
 * @returns {{ direction: 'down'|'up'|'same'|null, absKg: number|null, label: string|null, className: string, color: string }}
 */
export function resolveWeightDeltaDisplay(previousWeight, currentWeight) {
  const previous = formatKg(previousWeight);
  const current = formatKg(currentWeight);
  if (previous == null || current == null) {
    return {
      direction: null,
      absKg: null,
      label: null,
      className: 'text-gray-500',
      color: '#6b7280',
    };
  }
  const delta = Math.round((current - previous) * 100) / 100;
  const absKg = Math.abs(delta);
  if (delta < 0) {
    return {
      direction: 'down',
      absKg,
      label: formatDeltaChangeLabel('Decreased', absKg),
      className: 'text-emerald-600',
      color: '#16a34a',
    };
  }
  if (delta > 0) {
    return {
      direction: 'up',
      absKg,
      label: formatDeltaChangeLabel('Increased', absKg),
      className: 'text-red-600',
      color: '#dc2626',
    };
  }
  return {
    direction: 'same',
    absKg: 0,
    label: 'No change',
    className: 'text-gray-500',
    color: '#6b7280',
  };
}

/** Body weight must be a positive finite kg value. */
export function formatPositiveWeightKg(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

function formatKg(value) {
  return formatPositiveWeightKg(value);
}

/**
 * Day-to-day deltas (< 1 kg) in grams; larger swings stay in kg.
 * @param {'Increased'|'Decreased'} verb
 * @param {number} absKg
 */
function formatDeltaChangeLabel(verb, absKg) {
  if (absKg < 1) {
    const grams = Math.round(absKg * 1000);
    return `${verb} by ${grams} g`;
  }
  return `${verb} by ${absKg} kg`;
}
