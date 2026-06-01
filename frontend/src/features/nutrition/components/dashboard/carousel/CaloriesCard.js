import React from 'react';
import { Flame, Zap, TrendingDown } from 'lucide-react';

const Bar = ({ pct, color }) => (
  <div className="w-full bg-gray-200/70 rounded-full h-2 overflow-hidden">
    <div
      className={`h-2 rounded-full transition-all duration-500 ease-out ${color}`}
      style={{ width: `${pct}%` }}
    />
  </div>
);

/**
 * CaloriesCard — Card 1 of the Nutrition Carousel.
 * Shows Target (BMR), Consumed, Exercise (always 0 today), Remaining.
 */
const CaloriesCard = ({ target, consumed, exercise, remaining, progressPercent }) => {
  const isOver = consumed > target;
  const barColor = isOver
    ? 'bg-gradient-to-r from-rose-400 to-red-500'
    : progressPercent >= 80
      ? 'bg-gradient-to-r from-amber-400 to-orange-400'
      : 'bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-500';

  return (
    <div className="h-full flex flex-col justify-between px-4 py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <Flame className="w-4 h-4 text-orange-500" />
          <span className="text-sm font-semibold text-gray-700">Calories</span>
        </div>
        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${isOver ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
          {isOver ? 'Over target' : `${progressPercent}% of goal`}
        </span>
      </div>

      {/* Main stat */}
      <div className="mb-3">
        <p className="text-[11px] text-gray-400 mb-0.5">Consumed</p>
        <p className="text-3xl font-bold text-gray-900 leading-none">
          {consumed.toLocaleString()}
          <span className="text-sm font-normal text-gray-400 ml-1">kcal</span>
        </p>
      </div>

      {/* Progress bar */}
      <Bar pct={progressPercent} color={barColor} />

      {/* 3-column breakdown */}
      <div className="grid grid-cols-3 gap-2 mt-3">
        <div className="flex flex-col items-center bg-blue-50 rounded-xl p-2">
          <Zap className="w-3.5 h-3.5 text-blue-500 mb-0.5" />
          <p className="text-[10px] text-gray-500">Target</p>
          <p className="text-sm font-bold text-gray-800">{target.toLocaleString()}</p>
        </div>
        <div className="flex flex-col items-center bg-orange-50 rounded-xl p-2">
          <Flame className="w-3.5 h-3.5 text-orange-500 mb-0.5" />
          <p className="text-[10px] text-gray-500">Exercise</p>
          <p className="text-sm font-bold text-gray-800">{exercise}</p>
        </div>
        <div className="flex flex-col items-center bg-emerald-50 rounded-xl p-2">
          <TrendingDown className="w-3.5 h-3.5 text-emerald-600 mb-0.5" />
          <p className="text-[10px] text-gray-500">Remaining</p>
          <p className={`text-sm font-bold ${isOver ? 'text-rose-600' : 'text-emerald-700'}`}>
            {isOver ? `-${(consumed - target).toLocaleString()}` : remaining.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
};

export default CaloriesCard;
