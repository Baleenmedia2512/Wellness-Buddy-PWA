/**
 * Katch-McArdle BMR — mirrors backend/utils/bmrCalculations.js for UI auto-fill.
 * LBM = Weight × (1 - Body Fat % / 100)
 * BMR = 370 + (21.6 × LBM)
 */

const MIN_WEIGHT_KG = 20;
const MAX_WEIGHT_KG = 500;
const MIN_BODY_FAT_PCT = 1;
const MAX_BODY_FAT_PCT = 70;

function toPositiveNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = parseFloat(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export function computeLeanBodyMass(weightKg, bodyFatPercent) {
  const w = toPositiveNumber(weightKg);
  const bf = toPositiveNumber(bodyFatPercent);
  if (w === null || bf === null || w < MIN_WEIGHT_KG || w > MAX_WEIGHT_KG) return null;
  if (bf < MIN_BODY_FAT_PCT || bf > MAX_BODY_FAT_PCT) return null;
  const lbm = w * (1 - bf / 100);
  if (!Number.isFinite(lbm) || lbm <= 0) return null;
  return Math.round(lbm * 10) / 10;
}

export function computeKatchMcArdleBmr(weightKg, bodyFatPercent) {
  const lbm = computeLeanBodyMass(weightKg, bodyFatPercent);
  if (lbm === null) return null;
  const bmr = 370 + 21.6 * lbm;
  if (!Number.isFinite(bmr) || bmr <= 0) return null;
  return Math.round(bmr);
}
