import React, { useMemo } from 'react';

/**
 * Rank mark for Home leaderboard strips.
 * Uses a self-contained SVG Data URI rendered via an <img> element.
 *
 * Why <img> with SVG Data URI?
 * html2canvas has severe baseline miscalculation bugs with DOM text nodes
 * and flexbox inside rounded containers (which drop text into the bottom of the circle)
 * and can fail to resolve inline SVG gradients/font metrics when cloning DOM elements.
 * By rendering a self-contained SVG data URI as an <img>, both the live browser
 * and html2canvas paint the badge natively via ctx.drawImage(), guaranteeing
 * the rank number is mathematically and visually dead-center inside the circle.
 */
function buildRankBadgeDataUri(rank, colorClass = '') {
  const isMultiDigit = String(rank).length > 1;
  const fontSize = isMultiDigit ? 26 : 30; // 72x72 viewBox

  let stops = ['#22c55e', '#15803d'];
  let textColor = '#ffffff';

  if (colorClass.includes('yellow') || rank === 1) {
    stops = ['#facc15', '#ca8a04'];
    textColor = '#ffffff';
  } else if (colorClass.includes('gray') || rank === 2) {
    stops = ['#d1d5db', '#6b7280'];
    textColor = '#111827';
  } else if (colorClass.includes('orange') || rank === 3) {
    stops = ['#fb923c', '#ea580c'];
    textColor = '#ffffff';
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 72 72">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${stops[0]}"/>
        <stop offset="100%" stop-color="${stops[1]}"/>
      </linearGradient>
    </defs>
    <circle cx="36" cy="36" r="36" fill="url(#g)"/>
    <text x="36" y="36" text-anchor="middle" dominant-baseline="central" fill="${textColor}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="${fontSize}" font-weight="800">${rank}</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export default function LeaderboardRankBadge({ rank = 1, colorClass = '', className = '' }) {
  const src = useMemo(() => buildRankBadgeDataUri(rank, colorClass), [rank, colorClass]);

  return (
    <img
      src={src}
      alt={`Rank ${rank}`}
      width={36}
      height={36}
      className={className || "w-8 h-8 sm:w-9 sm:h-9 shrink-0 select-none drop-shadow-sm pointer-events-none"}
      draggable={false}
    />
  );
}
