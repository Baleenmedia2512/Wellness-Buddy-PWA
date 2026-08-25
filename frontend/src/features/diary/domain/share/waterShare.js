/**
 * diary/domain/share/waterShare.js
 * WhatsApp caption for water diary entries — quantity only.
 */

import { formatWaterVolume } from '../formatVolume';

/**
 * @param {{ volumeMl?: number|null, volumeLabel?: string|null }} input
 * @returns {string}
 */
export function buildWaterShareText({ volumeMl = null, volumeLabel = null } = {}) {
  const consumed = volumeLabel
    || (volumeMl != null ? formatWaterVolume(volumeMl) : null)
    || '—';
  return [
    '💧 Water Intake',
    '',
    `*Consumed: ${consumed}*`,
  ].join('\n');
}
