import React from 'react';
import { Flame, Utensils, User } from 'lucide-react';
import CarouselPeriodHeader from './CarouselPeriodHeader';

/**
 * CaloriesCard — Mobile-First Compact Card 1 of the Nutrition Carousel.
 * Shows Remaining (Goal - Food + Exercise), Base Goal, Food, Exercise.
 * Formula: Remaining = DailyGoal − Food + calories burned
 *
 * Design: Compact, mobile-optimized with circular progress.
 */

/** Scale centre % text so 3–4 digit values (e.g. 217%) never overflow / clip the ring. */
function percentFontSize(percentage, size) {
  const label = `${Math.round(Number(percentage) || 0)}%`;
  if (label.length >= 5) return Math.round(size * 0.22);
  if (label.length >= 4) return Math.round(size * 0.26);
  return Math.round(size * 0.32);
}

// Compact Circular Progress for mobile (green up to 100%, solid red when over)
const CompactCircularProgress = ({ percentage, size = 72, strokeWidth = 7, bmrTarget, onClick }) => {
  // Pad box so round stroke caps are not clipped by overflow:hidden ancestors.
  const pad = Math.ceil(strokeWidth / 2) + 2;
  const box = size + pad * 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const cx = size / 2 + pad;
  const cy = size / 2 + pad;

  const greenPct = Math.min(100, Math.max(0, percentage));
  const greenOffset = circumference - (greenPct / 100) * circumference;

  const redPct = Math.min(100, Math.max(0, percentage - 100));
  const redOffset = circumference - (redPct / 100) * circumference;

  const textColor = percentage <= 100 ? '#065f46' : '#dc2626';
  const pctLabel = `${Math.round(Number(percentage) || 0)}%`;
  const fontSize = percentFontSize(percentage, size);
  const subtitle = bmrTarget != null
    ? `of ${Number(bmrTarget).toLocaleString()}`
    : 'of BMR';

  return (
    <div
      className={`relative shrink-0 ${onClick ? 'cursor-pointer active:scale-95 transition-transform' : ''}`}
      style={{ width: box, height: box }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <svg
        width={box}
        height={box}
        viewBox={`0 0 ${box} ${box}`}
        className="block overflow-visible"
        style={{ transform: 'rotate(-90deg)' }}
        aria-hidden
      >
        <defs>
          <linearGradient id="compactCalGreen" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4ade80" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
          <linearGradient id="compactCalRed" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f87171" />
            <stop offset="100%" stopColor="#dc2626" />
          </linearGradient>
        </defs>

        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
          opacity="0.3"
        />

        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="url(#compactCalGreen)"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={greenOffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />

        {percentage > 100 && (
          <circle
            cx={cx}
            cy={cy}
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

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-1">
        <span
          className="max-w-full truncate font-extrabold leading-none tabular-nums"
          style={{ color: textColor, fontSize }}
        >
          {pctLabel}
        </span>
        <span
          className="mt-0.5 max-w-full truncate px-0.5 text-center font-medium leading-none"
          style={{
            color: percentage > 100 ? textColor : '#6b7280',
            fontSize: Math.max(8, Math.round(size * 0.11)),
          }}
        >
          {subtitle}
        </span>
      </div>
    </div>
  );
};

const CaloriesCard = ({ target, consumed, exercise, net, remaining, progressPercent, periodContext }) => {
  const isExceed = progressPercent > 100;
  // `net` = consumed − exercise; when exceeded, show net overage (not raw food overage).
  const exceeded = Math.max(0, (net ?? Math.max(0, consumed - exercise)) - target);
  const bigNumber = isExceed ? exceeded : remaining;
  const bigDigits = String(Math.round(bigNumber)).replace(/\D/g, '').length;

  return (
    <div className="flex h-full items-center justify-center py-1.5 min-[360px]:py-2">
      {/* Compact Card Container */}
      <div className="w-full overflow-hidden rounded-xl bg-white p-2.5 shadow-lg min-[360px]:p-3">
        <CarouselPeriodHeader periodContext={periodContext} />
        {/* Header */}
        <div className="mb-1.5 flex items-center justify-between gap-2 min-[360px]:mb-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-rose-500 shadow-md">
              <Flame className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="truncate text-sm font-bold text-gray-900 min-[360px]:text-base">Calories</span>
          </div>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            isExceed
              ? 'bg-rose-100 text-rose-700'
              : 'bg-emerald-100 text-emerald-700'
          }`}>
            {isExceed ? 'Exceeded' : 'On Track'}
          </span>
        </div>

        {/* Formula */}
        <p className="mb-1.5 px-0.5 text-center text-[8px] leading-snug text-gray-500 min-[360px]:text-[9px]">
          {periodContext?.isMultiDay
            ? 'Progress = total food − total exercise vs period calorie goal'
            : 'Remaining = DailyGoal − Food + calories burned'}
        </p>

        {/* Main Section — Circle + Remaining (min-w-0 + gap so ring never clips) */}
        <div className="mb-2 flex min-w-0 items-center gap-2 min-[360px]:gap-3">
          <CompactCircularProgress
            percentage={progressPercent}
            size={64}
            strokeWidth={6}
            bmrTarget={target}
          />

          <div className="min-w-0 flex-1 text-center">
            <p
              className={`font-extrabold leading-none tabular-nums ${
                isExceed ? 'text-rose-600' : 'text-gray-900'
              } ${bigDigits >= 5 ? 'text-xl min-[360px]:text-2xl' : 'text-2xl min-[360px]:text-3xl'}`}
            >
              {bigNumber.toLocaleString()}
            </p>
            <p className="mt-0.5 text-[11px] font-semibold text-gray-600 min-[360px]:text-xs">
              {isExceed ? 'Exceeded' : 'Remaining'}
            </p>
          </div>
        </div>

        {/* Breakdown Stats */}
        <div className="grid grid-cols-3 gap-1 border-t border-gray-100 pt-2 min-[360px]:gap-2">
          <div className="min-w-0 text-center">
            <div className="mx-auto mb-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-blue-50">
              <User className="h-3.5 w-3.5 text-blue-500" />
            </div>
            <p className="mb-0 truncate text-[9px] text-gray-500 min-[360px]:text-[10px]">
              {periodContext?.goalLabel ?? 'Calories limit'}
            </p>
            <p className="truncate text-[11px] font-bold tabular-nums text-gray-900 min-[360px]:text-xs">
              {target.toLocaleString()}
            </p>
          </div>

          <div className="min-w-0 text-center">
            <div className="mx-auto mb-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-orange-50">
              <Utensils className="h-3.5 w-3.5 text-orange-500" />
            </div>
            <p className="mb-0 truncate text-[9px] text-gray-500 min-[360px]:text-[10px]">Food</p>
            <p className="truncate text-[11px] font-bold tabular-nums text-gray-900 min-[360px]:text-xs">
              {consumed.toLocaleString()}
            </p>
          </div>

          <div className="min-w-0 text-center">
            <div className="mx-auto mb-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-orange-50">
              <Flame className="h-3.5 w-3.5 text-orange-500" />
            </div>
            <p className="mb-0 truncate text-[9px] text-gray-500 min-[360px]:text-[10px]">Calories burned</p>
            <p className="truncate text-[11px] font-bold tabular-nums text-gray-900 min-[360px]:text-xs">
              {exercise.toLocaleString()}
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default CaloriesCard;
