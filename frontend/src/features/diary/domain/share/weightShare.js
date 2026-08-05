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
    `Previous Weight: ${previous != null ? `${previous} kg` : '—'}`,
    `Current Weight: ${current != null ? `${current} kg` : '—'}`,
  ];

  if (previous != null && current != null) {
    const delta = Math.round((current - previous) * 100) / 100;
    const abs = Math.abs(delta);
    if (delta < 0) {
      lines.push('', `⬇️ Decreased by ${abs} kg`);
    } else if (delta > 0) {
      lines.push('', `⬆️ Increased by ${abs} kg`);
    } else {
      lines.push('', 'No change');
    }
  }

  return lines.join('\n');
}

/**
 * UI chrome for weight delta (green decrease / red increase).
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
      label: `Decreased by ${absKg} kg`,
      className: 'text-emerald-600',
      color: '#16a34a',
    };
  }
  if (delta > 0) {
    return {
      direction: 'up',
      absKg,
      label: `Increased by ${absKg} kg`,
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

function formatKg(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}
