/**
 * OverviewTab.js — header summary card for the discipline report.
 *
 * Renders the three-tile summary (Avg Score / Top Star / At Risk) plus
 * the avg-score progress bar. Returns null when no summary is yet
 * available so it can be slotted directly into `topContent`.
 */
import React from 'react';

const Tile = ({ children }) => (
  <div className="p-2 sm:p-3 md:p-4 flex flex-col items-center justify-between text-center min-h-[90px] sm:min-h-[110px]">
    {children}
  </div>
);

const Label = ({ children, color = 'text-gray-400' }) => (
  <div className={`text-[8px] sm:text-[10px] md:text-xs font-bold ${color} uppercase tracking-wider`}>
    {children}
  </div>
);

const PercentValue = ({ value, valueColor = 'text-gray-900' }) => (
  <div className="flex items-baseline justify-center gap-0.5 my-0.5 sm:my-1">
    <span className={`text-lg sm:text-xl md:text-2xl font-bold ${valueColor}`}>{value}</span>
    <span className="text-[10px] sm:text-xs text-gray-400">%</span>
  </div>
);

const OverviewTab = ({ summaryStats }) => {
  if (!summaryStats) return null;
  const { avgScore, onTimePercentage, topPerformer, atRiskCount, totalMembers } = summaryStats;
  return (
    <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-3 sm:mb-4">
      <div className="grid grid-cols-3 divide-x divide-gray-50">
        <Tile>
          <Label>Avg Score</Label>
          <PercentValue value={avgScore} />
          <div className="text-[8px] sm:text-[10px] md:text-xs text-green-600 font-medium bg-green-50 px-1.5 sm:px-2 py-0.5 rounded-full">
            {onTimePercentage}% Posts
          </div>
        </Tile>
        <Tile>
          <Label color="text-green-600">Top Star</Label>
          {topPerformer ? (
            <>
              <PercentValue value={topPerformer.score} />
              <div className="text-[8px] sm:text-[10px] md:text-xs text-gray-500 font-medium truncate max-w-[90%]">
                {topPerformer.name?.split(' ')[0]}
              </div>
            </>
          ) : (
            <div className="text-gray-300">-</div>
          )}
        </Tile>
        <Tile>
          <Label color="text-red-400">At Risk</Label>
          <div className="flex items-baseline justify-center gap-0.5 my-0.5 sm:my-1">
            <span className="text-lg sm:text-xl md:text-2xl font-bold text-red-600">{atRiskCount}</span>
          </div>
          <div className="text-[8px] sm:text-[10px] md:text-xs text-gray-400 font-medium">
            of {totalMembers} Members
          </div>
        </Tile>
      </div>
      <div className="h-1 w-full bg-gray-50">
        <div className="h-full bg-green-500 transition-all duration-500" style={{ width: `${avgScore}%` }} />
      </div>
    </div>
  );
};

export default OverviewTab;
