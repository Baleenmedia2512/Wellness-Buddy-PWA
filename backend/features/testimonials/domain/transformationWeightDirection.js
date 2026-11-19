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

/**
 * Blue result line on the Transformation share card.
 * Weight change: "Lost 5.0 kgs in 4 months".
 * Same before/after weight: duration alone ("4 months"), so it is not dropped.
 *
 * @param {unknown} beforeWeightKg
 * @param {unknown} afterWeightKg
 * @param {unknown} durationText
 * @returns {string}
 */
export function shareCardResultPillLabel(beforeWeightKg, afterWeightKg, durationText) {
  const before = Number(beforeWeightKg);
  const after = Number(afterWeightKg);
  const hasDiff = Number.isFinite(before) && Number.isFinite(after) && before > 0 && after > 0 && before !== after;
  const diff = hasDiff ? Math.abs(after - before).toFixed(1) : null;
  const verb = transformationWeightVerb(before, after);
  const durationRaw = String(durationText || '').replace(/\s+/g, ' ').trim();
  const duration = durationRaw && durationRaw !== '—' && durationRaw !== '-' ? durationRaw : '';
  if (diff && verb) return `${verb} ${diff} kgs${duration ? ` in ${duration}` : ''}`;
  return duration;
}
