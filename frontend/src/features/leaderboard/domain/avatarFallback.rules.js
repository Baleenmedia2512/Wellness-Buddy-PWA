/**
 * Color palette and SVG Data URI builder for leaderboard fallback letter avatars.
 * Pure — no I/O, no JSX.
 */

export const COLOR_HEXES = [
  '#3b82f6', // blue-500
  '#22c55e', // green-500
  '#a855f7', // purple-500
  '#ec4899', // pink-500
  '#6366f1', // indigo-500
  '#eab308', // yellow-500
  '#ef4444', // red-500
  '#14b8a6', // teal-500
];

export function escapeXml(unsafe) {
  return String(unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Builds a self-contained SVG Data URI for fallback letter avatars.
 *
 * Why SVG Data URI?
 * html2canvas has severe baseline miscalculation bugs with DOM text nodes and
 * flexbox inside rounded containers (which drop the letter into the bottom of the circle).
 * By using an SVG Data URI with `text-anchor="middle"` and `dominant-baseline="central"`,
 * both live browsers and html2canvas render the letter mathematically and visually
 * at dead-center inside the circle (matching LeaderboardRankBadge).
 */
export function buildAvatarFallbackDataUri(initial, colorHex) {
  const safeChar = escapeXml((String(initial || '?').charAt(0) || '?').toUpperCase());
  const safeColor = colorHex || '#14b8a6';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 72 72">
    <circle cx="36" cy="36" r="36" fill="${safeColor}"/>
    <text x="36" y="36" text-anchor="middle" dominant-baseline="central" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="34" font-weight="700">${safeChar}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
