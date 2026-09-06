import React from 'react';

/**
 * Rank mark for Home leaderboard strips — large enough to read at a glance.
 */
export default function LeaderboardRankBadge({ rank, colorClass, icon }) {
  return (
    <div
      className={`inline-flex flex-col items-center justify-center gap-0.5 flex-shrink-0 min-w-[2.75rem] sm:min-w-[3.25rem] h-12 sm:h-14 rounded-xl px-1.5 shadow-sm ${colorClass}`}
    >
      {icon}
      <span className="text-xs sm:text-sm font-extrabold leading-none tracking-tight">
        #{rank}
      </span>
    </div>
  );
}
