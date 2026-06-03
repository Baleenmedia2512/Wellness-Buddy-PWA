import React from 'react';
import { Flame, Utensils, User } from 'lucide-react';

/**
 * CaloriesCard — Mobile-First Compact Card 1 of the Nutrition Carousel.
 * Shows Remaining (Goal - Food + Exercise), Base Goal, Food, Exercise.
 * Formula: Remaining = Goal - Food + Exercise
 * 
 * Design: Compact, mobile-optimized with circular progress.
 */

// Compact Circular Progress for mobile (two-layer: green base + red overlay when exceeding)
const CompactCircularProgress = ({ percentage, size = 100, strokeWidth = 10, bmrTarget }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Green arc: always capped at 100%
  const greenPct = Math.min(percentage, 100);
  const greenOffset = circumference - (greenPct / 100) * circumference;
  
  // Red arc: only shows excess beyond 100%
  const isExceeding = percentage > 100;
  const excessPct = isExceeding ? percentage - 100 : 0;
  const redOffset = circumference - (excessPct / 100) * circumference;

  const textColor = isExceeding ? '#dc2626' : '#065f46';
  const subtitle  = bmrTarget ? `of ${bmrTarget.toLocaleString()}` : 'of BMR';

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <defs>
          {/* Green gradient */}
          <linearGradient id="compactCalGreen" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4ade80" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
          {/* Red gradient */}
          <linearGradient id="compactCalRed" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f87171" />
            <stop offset="100%" stopColor="#dc2626" />
          </linearGradient>
        </defs>

        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
          opacity="0.3"
        />

        {/* Green arc (base, up to 100%) */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#compactCalGreen)"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={greenOffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />

        {/* Red arc (excess, only when > 100%) */}
        {isExceeding && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="url(#compactCalRed)"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={redOffset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.5s ease' }}
          />
        )}
      </svg>

      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-extrabold leading-none" style={{ color: textColor }}>
          {percentage}%
        </span>
        <span className="text-[9px] font-medium mt-0.5" style={{ color: percentage > 100 ? textColor : '#6b7280' }}>{subtitle}</span>
      </div>
    </div>
  );
};

// Mini progress bar for stat cards
const MiniProgressBar = ({ percentage, color }) => {
  const pct = Math.min(100, percentage);
  return (
    <div className="w-full bg-gray-100 rounded-full h-1 overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-300 ease-out"
        style={{ 
          width: `${pct}%`, 
          backgroundColor: color,
          willChange: 'width'
        }}
      />
    </div>
  );
};

const CaloriesCard = ({ target, consumed, exercise, remaining, progressPercent }) => {
  const isExceed = progressPercent > 100;
  const exceeded = Math.max(0, consumed - target);

  return (
    <div className="h-full flex items-start justify-center pt-2 px-3">
      {/* Compact Card Container */}
      <div className="bg-white rounded-2xl shadow-lg p-4 w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-rose-500 flex items-center justify-center shadow-md">
              <Flame className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold text-gray-900">Calories</span>
          </div>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
            isExceed
              ? 'bg-rose-100 text-rose-700'
              : 'bg-emerald-100 text-emerald-700'
          }`}>
            {isExceed ? 'Exceeded' : 'On Track'}
          </span>
        </div>

        {/* Formula */}
        <p className="text-[10px] text-gray-500 text-center mb-2">
          Remaining = Goal - Food + Exercise
        </p>

        {/* Main Section — Circle + Remaining */}
        <div className="flex items-center justify-between mb-3">
          {/* Left: Circular progress */}
          <CompactCircularProgress percentage={progressPercent} size={80} strokeWidth={8} bmrTarget={target} />
          
          {/* Right: Remaining */}
          <div className="flex-1 text-center">
            <p className={`text-4xl font-extrabold leading-none mb-1 ${
              isExceed ? 'text-rose-600' : 'text-gray-900'
            }`}>
              {isExceed ? exceeded.toLocaleString() : remaining.toLocaleString()}
            </p>
            <p className="text-sm text-gray-600 font-semibold">
              {isExceed ? 'Exceeded' : 'Remaining'}
            </p>
          </div>
        </div>

        {/* Breakdown Stats - Small Icons on Right */}
        <div className="grid grid-cols-3 gap-2 pt-3 border-t border-gray-100">
          {/* Base Goal */}
          <div className="text-center">
            <div className="w-8 h-8 mx-auto mb-1 rounded-full bg-blue-50 flex items-center justify-center">
              <User className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-xs text-gray-500 mb-0.5">BMR</p>
            <p className="text-sm font-bold text-gray-900">{target.toLocaleString()}</p>
          </div>

          {/* Food */}
          <div className="text-center">
            <div className="w-8 h-8 mx-auto mb-1 rounded-full bg-orange-50 flex items-center justify-center">
              <Utensils className="w-4 h-4 text-orange-500" />
            </div>
            <p className="text-xs text-gray-500 mb-0.5">Food</p>
            <p className="text-sm font-bold text-gray-900">{consumed.toLocaleString()}</p>
          </div>

          {/* Exercise */}
          <div className="text-center">
            <div className="w-8 h-8 mx-auto mb-1 rounded-full bg-orange-50 flex items-center justify-center">
              <Flame className="w-4 h-4 text-orange-500" />
            </div>
            <p className="text-xs text-gray-500 mb-0.5">Exercise</p>
            <p className="text-sm font-bold text-gray-900">{exercise.toLocaleString()}</p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default CaloriesCard;
