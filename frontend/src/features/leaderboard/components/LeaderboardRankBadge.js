import React from 'react';

/**
 * Rank mark for Home leaderboard strips — circle with a large rank number only.
 */
export default function LeaderboardRankBadge({ rank, colorClass }) {
  return (
    <div
      className={`inline-flex items-center justify-center flex-shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-full shadow-sm ${colorClass}`}
      aria-label={`Rank ${rank}`}
    >
      <span
        className={`font-black leading-none tabular-nums tracking-tighter ${
          String(rank).length > 1
  ? 'text-xl sm:text-2xl'
  : 'text-2xl sm:text-3xl'
        }`}
      >
        {rank}
      </span>
    </div>
  );
}
