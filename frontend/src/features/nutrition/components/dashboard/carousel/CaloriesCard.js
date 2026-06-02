import React from 'react';
import { Flame, Utensils, Activity, Scale, Zap } from 'lucide-react';

/**
 * CaloriesCard — Mobile-First Compact Card 1 of the Nutrition Carousel.
 * Shows Remaining (Goal - Food + Exercise), Base Goal, Food, Exercise.
 * Formula: Remaining = Goal - Food + Exercise
 * 
 * Design: Compact, mobile-optimized with circular progress.
 */

// Compact Circular Progress for mobile
const CompactCircularProgress = ({ percentage, size = 100, strokeWidth = 10 }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  const isOver = percentage > 100;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#E5E7EB"
          strokeWidth={strokeWidth}
        />
        
        {/* Gradient definition */}
        <defs>
          <linearGradient id="compactGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: isOver ? '#f87171' : '#00D26A', stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: isOver ? '#dc2626' : '#00C2FF', stopOpacity: 1 }} />
          </linearGradient>
        </defs>
        
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#compactGradient)"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500 ease-out"
          style={{ willChange: 'stroke-dashoffset' }}
        />
      </svg>
      
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-extrabold text-gray-900 leading-none">
          {percentage}%
        </span>
        <span className="text-[9px] text-gray-500 font-medium mt-0.5">of goal</span>
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
  const isOver = consumed > target;
  const netCalories = consumed - exercise; // Net = Food - Exercise
  const foodProgress = target > 0 ? Math.round((consumed / target) * 100) : 0;
  const exerciseProgress = target > 0 ? Math.round((exercise / target) * 100) : 0;
  const netProgress = target > 0 ? Math.round((netCalories / target) * 100) : 0;

  return (
    <div className="h-full flex items-start justify-center pt-4 px-4">
      {/* Compact Card Container */}
      <div className="bg-white rounded-2xl shadow-lg p-5 w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-rose-500 flex items-center justify-center shadow-md">
              <Flame className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold text-gray-900">Calories</span>
          </div>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
            isOver 
              ? 'bg-rose-100 text-rose-700' 
              : 'bg-emerald-100 text-emerald-700'
          }`}>
            {isOver ? 'Over' : 'On Track'}
          </span>
        </div>

        {/* Formula */}
        <p className="text-[10px] text-gray-500 text-center mb-4">
          Remaining = Goal - Food + Exercise
        </p>

        {/* Main Section — Circle + Remaining */}
        <div className="flex items-center justify-between mb-4">
          {/* Left: Circular progress */}
          <CompactCircularProgress percentage={progressPercent} size={90} strokeWidth={9} />
          
          {/* Right: Remaining */}
          <div className="flex-1 text-center">
            <p className={`text-5xl font-extrabold leading-none mb-1 ${
              isOver ? 'text-rose-600' : 'text-gray-900'
            }`}>
              {isOver ? (
                <>-{(consumed - target).toLocaleString()}</>
              ) : (
                <>{remaining.toLocaleString()}</>
              )}
            </p>
            <p className="text-sm text-gray-600 font-semibold">Remaining</p>
          </div>
        </div>

        {/* Breakdown Stats - Small Icons on Right */}
        <div className="grid grid-cols-3 gap-3 pt-4 border-t border-gray-100">
          {/* Base Goal */}
          <div className="text-center">
            <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-blue-50 flex items-center justify-center">
              <Scale className="w-5 h-5 text-blue-500" />
            </div>
            <p className="text-xs text-gray-500 mb-0.5">Base Goal</p>
            <p className="text-sm font-bold text-gray-900">{target.toLocaleString()}</p>
          </div>

          {/* Food */}
          <div className="text-center">
            <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-orange-50 flex items-center justify-center">
              <Utensils className="w-5 h-5 text-orange-500" />
            </div>
            <p className="text-xs text-gray-500 mb-0.5">Food</p>
            <p className="text-sm font-bold text-gray-900">{consumed.toLocaleString()}</p>
          </div>

          {/* Exercise */}
          <div className="text-center">
            <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-emerald-50 flex items-center justify-center">
              <Activity className="w-5 h-5 text-emerald-500" />
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
