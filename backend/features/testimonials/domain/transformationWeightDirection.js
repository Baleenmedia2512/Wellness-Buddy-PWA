/**
 * Lost / Gained for Transformation cards must follow the real before→after
 * weight delta — not the member's goalType (loss vs gain program).
 */

/**
 * @param {unknown} beforeWeightKg
 * @param {unknown} afterWeightKg
 * @returns {boolean|null} true = loss, false = gain, null = not comparable / unchanged
 */
export function isTransformationWeightLoss(beforeWeightKg, afterWeightKg) {
  const before = Number(beforeWeightKg);
  const after = Number(afterWeightKg);
  if (!Number.isFinite(before) || !Number.isFinite(after) || before <= 0 || after <= 0) {
    return null;
  }
  if (before === after) return null;
  return after < before;
}

/**
 * @param {unknown} beforeWeightKg
 * @param {unknown} afterWeightKg
 * @param {{ capitalize?: boolean }} [opts]
 * @returns {string|null}
 */
export function transformationWeightVerb(beforeWeightKg, afterWeightKg, opts = {}) {
  const isLoss = isTransformationWeightLoss(beforeWeightKg, afterWeightKg);
  if (isLoss == null) return null;
  const capitalize = opts.capitalize !== false;
  if (capitalize) return isLoss ? 'Lost' : 'Gained';
  return isLoss ? 'lost' : 'gained';
}
