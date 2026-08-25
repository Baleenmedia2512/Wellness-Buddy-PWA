/**
 * shareCardCaptureKey.js — deterministic key for BCM share-card pixels.
 * Only fields that BodyParamsCardPreview paints. Used to reuse pre-capture.
 */
function normScalar(value) {
  if (value == null || value === '') return '';
  const n = Number(value);
  if (Number.isFinite(n) && String(value).trim() !== '') return String(n);
  return String(value).trim();
}

function normIssues(issues) {
  if (!Array.isArray(issues)) return '';
  return issues
    .map((v) => String(v || '').trim())
    .filter(Boolean)
    .sort()
    .join(',');
}

function previousKey(previousCard) {
  if (!previousCard) return 'none';
  return [
    normScalar(previousCard.id),
    normScalar(previousCard.weightKg),
    normScalar(previousCard.bmi),
    normScalar(previousCard.fatPercent),
    normScalar(previousCard.visceralFat),
    normScalar(previousCard.bodyAge),
    normScalar(previousCard.chestCm),
    normScalar(previousCard.waistCm),
    normScalar(previousCard.hipCm),
  ].join('|');
}

/**
 * @param {object|null|undefined} card
 * @param {object|null|undefined} [previousCard]
 * @returns {string}
 */
export function getShareCardCaptureKey(card, previousCard = null) {
  if (!card) return '';
  return [
    normScalar(card.recordedDate),
    normScalar(card.locationName),
    normScalar(card.name),
    normScalar(card.age),
    normScalar(card.heightCm),
    normScalar(card.phoneNumber),
    normScalar(card.gender),
    normScalar(card.bmr),
    normScalar(card.weightKg),
    normScalar(card.bmi),
    normScalar(card.fatPercent),
    normScalar(card.visceralFat),
    normScalar(card.bodyAge),
    normScalar(card.chestCm),
    normScalar(card.waistCm),
    normScalar(card.hipCm),
    normIssues(card.recoveredHealthIssues),
    previousKey(previousCard),
  ].join('\u0001');
}

/**
 * True when a pre-captured image for `preKey` can be reused for the final card.
 * Requires same painted fields (including previous-card layout).
 */
export function canReuseShareCapture(preKey, savedCard, previousCard = null) {
  if (!preKey) return false;
  return preKey === getShareCardCaptureKey(savedCard, previousCard);
}
