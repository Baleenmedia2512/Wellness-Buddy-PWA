/**
 * frontend/src/features/quick-share/domain/share-caption.rules.js
 * ---------------------------------------------------------------------------
 * Pure rules for building the WhatsApp share caption.
 * No I/O. No React.
 * ---------------------------------------------------------------------------
 */

/**
 * Build the text body for the WhatsApp share message.
 *
 * @param {{ imageType: 'weight'|'food'|'education'|'smartwatch'|null, viewUrl?: string|null, isBackground?: boolean }} opts
 * @returns {string}
 */
export function buildShareCaption({ imageType, viewUrl = null, isBackground = false }) {
  if (imageType === 'weight') {
    return 'Check out my weight update from Wellness Valley! 💪🏋️';
  }
  if (isBackground && viewUrl) {
    return `I just logged my meal on Wellness Valley! 🍽️ See the nutrition analysis: ${viewUrl}`;
  }
  return 'My meal from Wellness Valley! 🍽️';
}

/**
 * Build the share title (used by native share sheet).
 *
 * @param {{ imageType: 'weight'|'food'|string|null }} opts
 * @returns {string}
 */
export function buildShareTitle({ imageType }) {
  if (imageType === 'weight') return 'My Weight Update';
  return 'My Meal Analysis';
}
