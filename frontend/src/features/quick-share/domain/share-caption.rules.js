/**
 * frontend/src/features/quick-share/domain/share-caption.rules.js
 * ---------------------------------------------------------------------------
 * Pure rules that build the WhatsApp caption embedded with a quick-share
 * view URL. No I/O. Easy to unit-test.
 * ---------------------------------------------------------------------------
 */

/**
 * @param {string|null|undefined} viewUrl
 * @returns {string} caption text safe for WhatsApp ‘text’ field.
 *                   Returns '' if viewUrl is missing — callers should send
 *                   the image without a caption rather than a broken link.
 */
export function buildShareCaption(viewUrl) {
  if (!viewUrl || typeof viewUrl !== 'string') return '';
  return `My meal analysis 🍽\nSee the full report:\n${viewUrl}`;
}
