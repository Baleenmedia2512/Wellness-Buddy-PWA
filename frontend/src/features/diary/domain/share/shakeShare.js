/**
 * diary/domain/share/shakeShare.js
 * WhatsApp caption for protein shake diary entries.
 */

/**
 * @param {{ shakeName?: string|null, servings?: number|null }} input
 * @returns {string}
 */
export function buildShakeShareText({
  shakeName = 'Protein Shake',
  servings = 1,
} = {}) {
  const count = Number.isFinite(Number(servings)) && Number(servings) > 0
    ? Number(servings)
    : 1;
  return [
    '🥤 Protein Shake',
    '',
    `Name: ${shakeName || 'Protein Shake'}`,
    `Serving: ${count}`,
  ].join('\n');
}
