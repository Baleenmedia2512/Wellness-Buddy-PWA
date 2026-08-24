/**
 * BMI from height (cm) + weight (kg). Matches BCM / BPC form auto-fill.
 * @param {number|string|null|undefined} heightCm
 * @param {number|string|null|undefined} weightKg
 * @returns {number|null}
 */
export function computeBmiFromHeightWeight(heightCm, weightKg) {
  const h = Number(heightCm);
  const w = Number(weightKg);
  if (!Number.isFinite(h) || h < 50 || h > 250) return null;
  if (!Number.isFinite(w) || w < 20 || w > 300) return null;
  const m = h / 100;
  return Math.round((w / (m * m)) * 10) / 10;
}
