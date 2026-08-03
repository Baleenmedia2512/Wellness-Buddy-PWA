import React from 'react';

/**
 * Circular progress ring for overall wellness score (0–100).
 */
export default function ScoreCircularProgress({
  percentage,
  size = 88,
  strokeWidth = 9,
  subtitle = 'Today',
  onClick,
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, percentage));
  const offset = circumference - (clamped / 100) * circumference;

  const ringColor = clamped >= 75 ? '#059669' : clamped >= 50 ? '#d97706' : '#dc2626';

  return (
    <div
      className={`relative shrink-0 ${onClick ? 'cursor-pointer active:scale-95 transition-transform' : ''}`}
      style={{ width: size, height: size }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter') onClick(); } : undefined}
    >
      <svg width={size} height={size} className="transform -rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={ringColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-xl font-bold text-gray-900 leading-none">{Math.round(clamped)}</span>
        <span className="text-[9px] text-gray-500 font-medium mt-0.5">{subtitle}</span>
      </div>
    </div>
  );
}
