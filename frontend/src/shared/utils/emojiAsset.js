/**
 * Resolve a single emoji character to its Twemoji asset filename (lowercase hex).
 * e.g. '🌱' → '1f331', '👋' → '1f44b'
 */
export function emojiToAssetName(emoji) {
  if (!emoji) return '';
  const points = [];
  for (const char of emoji) {
    const cp = char.codePointAt(0);
    if (cp > 0xffff) {
      points.push(cp.toString(16));
    } else if (cp > 0x238c) {
      // Skip variation selectors / joiners handled separately in simple emojis
      points.push(cp.toString(16));
    }
  }
  // For standard single-codepoint emoji the first scalar is the asset name
  const first = [...emoji][0];
  return first ? first.codePointAt(0).toString(16) : points.join('-');
}

export function emojiAssetUrl(emoji) {
  const name = emojiToAssetName(emoji);
  if (!name) return '';
  const base = process.env.PUBLIC_URL || '';
  return `${base}/emoji/${name}.svg`;
}
