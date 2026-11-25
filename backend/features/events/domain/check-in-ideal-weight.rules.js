/**
 * Guest-pass Ideal Weight status — pure rules, no I/O.
 * Matches profile IdealWeightCards band (BMI 19–23) with ±0.5 kg hysteresis.
 */
import { computeIdealWeightRange } from '../../../utils/weightValidation.js';

/**
 * @param {{ heightCm?: number|string|null, currentWeightKg?: number|string|null }} input
 * @returns {{
 *   status: 'reached'|'above'|'below',
 *   currentKg: number,
 *   idealMin: number,
 *   idealMax: number,
 *   remainingKg: number,
 *   label: string,
 * }|null}
 */
export function buildCheckInIdealWeightProgress({ heightCm, currentWeightKg } = {}) {
  const range = computeIdealWeightRange(heightCm);
  const current = parseFloat(currentWeightKg);
  if (!range || !Number.isFinite(current) || current <= 0) return null;

  const { idealMin, idealMax } = range;
  const isLoss = current > idealMax + 0.5;
  const isGain = current < idealMin - 0.5;

  if (isLoss) {
    const remainingKg = parseFloat(Math.abs(current - idealMax).toFixed(1));
    return {
      status: 'above',
      currentKg: parseFloat(current.toFixed(2)),
      idealMin,
      idealMax,
      remainingKg,
      label: `${remainingKg} kg left to Ideal Weight`,
    };
  }

  if (isGain) {
    const remainingKg = parseFloat(Math.abs(idealMin - current).toFixed(1));
    return {
      status: 'below',
      currentKg: parseFloat(current.toFixed(2)),
      idealMin,
      idealMax,
      remainingKg,
      label: `${remainingKg} kg left to Ideal Weight`,
    };
  }

  return {
    status: 'reached',
    currentKg: parseFloat(current.toFixed(2)),
    idealMin,
    idealMax,
    remainingKg: 0,
    label: 'Ideal Weight reached',
  };
}
