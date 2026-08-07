/**
 * diary/domain/share/educationShare.js
 * WhatsApp caption for education diary entries.
 */

/**
 * @param {{ platform?: string|null, session?: string|null }} input
 * @returns {string}
 */
export function buildEducationShareText({
  platform = null,
  session = null,
} = {}) {
  return [
    '🎓 Education',
    '',
    `Platform: ${platform || '—'}`,
    `Session: ${session || '—'}`,
  ].join('\n');
}
