/**
 * diary/domain/share/shakeShare.js
 * WhatsApp caption for protein shake diary entries.
 */

/**
 * Scoop unit label: 1 → "scoop", otherwise "scoops".
 * @param {number} count
 * @returns {string}
 */
function scoopUnit(count) {
  return count === 1 ? 'scoop' : 'scoops';
}

/**
 * Compact scoop breakdown for captions, e.g.
 * "Formula 1: 3 scoops, Shakemate: 2 scoops, Personalized Protein: 1 scoop".
 * @param {{ formula1?: number, shakemate?: number, protein?: number }|null|undefined} products
 * @returns {string|null}
 */
export function formatShakeProductScoops(products) {
  if (!products || typeof products !== 'object') return null;
  const f1 = Math.max(0, Math.round(Number(products.formula1)) || 0);
  const sm = Math.max(0, Math.round(Number(products.shakemate)) || 0);
  const pp = Math.max(0, Math.round(Number(products.protein)) || 0);
  if (![
    Number(products.formula1),
    Number(products.shakemate),
    Number(products.protein),
  ].some((n) => Number.isFinite(n))) {
    return null;
  }
  const lines = [];
  if (f1 > 0) lines.push(`Formula 1: ${f1} ${scoopUnit(f1)}`);
  if (sm > 0) lines.push(`Shakemate: ${sm} ${scoopUnit(sm)}`);
  if (pp > 0) lines.push(`Personalized Protein: ${pp} ${scoopUnit(pp)}`);
  return lines.length > 0 ? lines.join(', ') : null;
}

/**
 * @param {{
 *   shakeName?: string|null,
 *   servings?: number|null,
 *   shakeProducts?: { formula1?: number, shakemate?: number, protein?: number }|null,
 * }} input
 * @returns {string}
 */
export function buildShakeShareText({
  shakeName = 'Protein Shake',
  servings = 1,
  shakeProducts = null,
} = {}) {
  const count = Number.isFinite(Number(servings)) && Number(servings) > 0
    ? Number(servings)
    : 1;
  const scoopLine = formatShakeProductScoops(shakeProducts);
  const lines = [
    '🥤 Protein Shake',
    '',
    `Name: ${shakeName || 'Protein Shake'}`,
  ];
  if (scoopLine) {
    lines.push(scoopLine);
  } else {
    lines.push(`Serving: ${count}`);
  }
  return lines.join('\n');
}
