/**
 * diary/domain/share/afreshShare.js
 * WhatsApp caption for Afresh diary entries — scoops only (no meal category).
 */

/**
 * @param {{ scoops?: number|null }} input
 * @returns {string}
 */
export function buildAfreshShareText({ scoops = null } = {}) {
  const count = Number.isFinite(Number(scoops)) && Number(scoops) > 0
    ? Number(scoops)
    : 1;
  return [
    '🥤 Afresh',
    '',
    `Scoops: ${count}`,
  ].join('\n');
}
