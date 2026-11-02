/**
 * diary/domain/formatVolume.js
 *
 * Display helpers for diary water quantity (L / mL).
 * Pure — zero I/O.
 */

/**
 * Format millilitres for diary / share display.
 * ≥1000 → L (e.g. 1 L, 1.5 L); otherwise mL (e.g. 500 mL).
 *
 * @param {number} ml
 * @returns {string}
 */
export function formatWaterVolume(ml) {
  const n = Number(ml);
  if (!Number.isFinite(n) || n <= 0) return '0 mL';
  if (n >= 1000) {
    const liters = n / 1000;
    const label = Number.isInteger(liters)
      ? String(liters)
      : String(Math.round(liters * 100) / 100).replace(/\.?0+$/, '');
    return `${label} L`;
  }
  return `${Math.round(n)} mL`;
}
