/**
 * WeightSummaryCards.js — pure renderer for the weight summary slide.
 *
 * Shows current vs previous weight (with trending diff icon and color
 * logic) plus the lowest/highest tiles backed by `globalStats`.
 */
import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { istToLocalDate } from '../../../shared/utils/timezoneUtils';

const renderDiff = (latest, previous) => {
  if (!latest || previous === null || previous === undefined) {
    return (
      <p className="flex items-center justify-end gap-0.5 text-[10px] xs:text-xs text-gray-400 font-medium mt-0.5 sm:mt-1">
        <Minus className="w-3 h-3 xs:w-3.5 xs:h-3.5" />- kg
      </p>
    );
  }
  const diff = (parseFloat(latest.Weight) - parseFloat(previous)).toFixed(2);
  const diffNum = parseFloat(diff);
  if (diffNum > 0) {
    return (
      <p className="flex items-center justify-end gap-0.5 text-[10px] xs:text-xs text-red-500 font-medium mt-0.5 sm:mt-1">
        <TrendingUp className="w-3 h-3 xs:w-3.5 xs:h-3.5" />+{diff} kg
      </p>
    );
  }
  if (diffNum < 0) {
    return (
      <p className="flex items-center justify-end gap-0.5 text-[10px] xs:text-xs text-green-600 font-medium mt-0.5 sm:mt-1">
        <TrendingDown className="w-3 h-3 xs:w-3.5 xs:h-3.5" />{diff} kg
      </p>
    );
  }
  return (
    <p className="flex items-center justify-end gap-0.5 text-[10px] xs:text-xs text-gray-500 font-medium mt-0.5 sm:mt-1">
      <Minus className="w-3 h-3 xs:w-3.5 xs:h-3.5" />0.00 kg
    </p>
  );
};

const StatTile = ({ label, value, icon }) => (
  <div className="bg-white rounded-lg sm:rounded-xl p-2 sm:p-3 text-center border border-white/40">
    <p className="text-[10px] xs:text-xs text-gray-600 mb-0.5 sm:mb-1">{label}</p>
    <p className="text-lg xs:text-xl font-bold text-gray-900">
      {value !== null && value !== undefined ? value.toFixed(1) : '-'}
    </p>
    <p className="text-[10px] xs:text-xs text-gray-500">kg</p>
    {icon}
  </div>
);

const WeightSummaryCards = ({ summaryRef, latestWeight, previousWeight, globalStats }) => {
  const hasLow = globalStats?.minWeight !== null && globalStats?.minWeight !== undefined;
  const hasHigh = globalStats?.maxWeight !== null && globalStats?.maxWeight !== undefined;
  return (
    <div ref={summaryRef} className="w-1/2 shrink-0 px-4 md:px-5 pb-4 md:pb-5 text-black">
      <div className="flex items-start justify-between mb-4 md:mb-5">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] xs:text-xs sm:text-sm text-gray-500 mb-0.5 sm:mb-1">Current Weight</p>
          <div className="flex items-baseline flex-wrap">
            <span className="text-xl xs:text-2xl sm:text-3xl font-bold text-black">
              {latestWeight ? latestWeight.Weight : '-'}
            </span>
            <span className="text-xs xs:text-sm sm:text-base font-normal ml-0.5 sm:ml-1 text-gray-600">kg</span>
          </div>
          <p className="text-[10px] xs:text-xs text-gray-500 mt-0.5 sm:mt-1">
            {(latestWeight ? istToLocalDate(latestWeight.CreatedAt) : new Date())
              .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <div className="flex-1 min-w-0 text-right">
          <p className="text-[10px] xs:text-xs sm:text-sm text-gray-500 mb-0.5 sm:mb-1">Previous Weight</p>
          <div className="flex items-baseline justify-end flex-wrap">
            <span className="text-xl xs:text-2xl sm:text-3xl font-bold text-gray-500">
              {previousWeight !== null ? previousWeight : '-'}
            </span>
            <span className="text-xs xs:text-sm sm:text-base font-normal ml-0.5 sm:ml-1 text-gray-600">kg</span>
          </div>
          {renderDiff(latestWeight, previousWeight)}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:gap-3 mt-3 sm:mt-4">
        <StatTile
          label="Lowest"
          value={hasLow ? globalStats.minWeight : null}
          icon={hasLow
            ? <TrendingDown className="w-3 h-3 xs:w-4 xs:h-4 mx-auto mt-0.5 sm:mt-1 text-green-600" />
            : <Minus className="w-4 h-3 xs:w-5 xs:h-4 mx-auto mt-0.5 sm:mt-1 text-gray-400" />}
        />
        <StatTile
          label="Highest"
          value={hasHigh ? globalStats.maxWeight : null}
          icon={hasHigh
            ? <TrendingUp className="w-3 h-3 xs:w-4 xs:h-4 mx-auto mt-0.5 sm:mt-1 text-red-500" />
            : <Minus className="w-4 h-3 xs:w-5 xs:h-4 mx-auto mt-0.5 sm:mt-1 text-gray-400" />}
        />
      </div>
    </div>
  );
};

export default WeightSummaryCards;
