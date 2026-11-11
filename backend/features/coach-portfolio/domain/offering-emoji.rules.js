/**
 * Map service offering labels to a single emoji for the public storybook UI.
 */

export function offeringEmoji(label) {
  const s = String(label || '').toLowerCase();
  if (/family|breakfast/.test(s)) return '🥗';
  if (/weight\s*gain|gain\s*weight/.test(s)) return '📈';
  if (/weight\s*loss|lose\s*weight/.test(s)) return '📉';
  if (/kids|child|children/.test(s)) return '🧒';
  if (/sports|athlete|workout/.test(s)) return '🏃';
  if (/targeted|heart|digestive|joint|skin/.test(s)) return '🎯';
  if (/weight/.test(s)) return '🏋️';
  if (/nutrition|food|diet|meal/.test(s)) return '🥗';
  if (/lifestyle|habit/.test(s)) return '🌱';
  if (/fitness|exercise/.test(s)) return '🏃';
  if (/online/.test(s)) return '💬';
  if (/group/.test(s)) return '👥';
  if (/wellness|consult|guidance|coach/.test(s)) return '💚';
  return '✨';
}

/**
 * @param {string[]} offerings
 * @returns {{ label: string, emoji: string }[]}
 */
export function offeringsWithEmoji(offerings) {
  if (!Array.isArray(offerings)) return [];
  return offerings
    .map((label) => String(label || '').trim())
    .filter(Boolean)
    .map((label) => ({ label, emoji: offeringEmoji(label) }));
}
