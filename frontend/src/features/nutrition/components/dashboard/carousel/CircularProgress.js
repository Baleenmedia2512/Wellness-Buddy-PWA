import React from 'react';

/**
 * CircularProgress — Circular progress ring for nutrition metrics.
 *
 * Color rules:
 *   0–100%  : green gradient fills the ring proportionally
 *   >100%   : entire ring is solid red (over-target = unhealthy, no green)
 *
 * A percentage label is always rendered in the centre of the ring.
 *
 * @param {number} percentage   Actual percentage (unclamped, may exceed 100)
 * @param {number} size         Diameter in px (default 70)
 * @param {number} strokeWidth  Ring thickness in px (default 6)
 */

const CircularProgress = ({
  percentage,
  size = 70,
  strokeWidth = 6,
  targetLabel,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circum = 2 * Math.PI * radius;

  // Green arc: fills 0-100%, stays at 100% beyond
  const greenPct = Math.min(100, Math.max(0, percentage));
  const greenOffset = circum - (greenPct / 100) * circum;

  // Red arc: starts at 0 until 100%, fills 0-100% from 100-200%, stays at 100% beyond 200%
  const redPct = Math.min(100, Math.max(0, percentage - 100));
  const redOffset = circum - (redPct / 100) * circum;

  // Unique gradient ids
  const greenGradId = `cpg-green-${size}-${percentage}`;
  const redGradId = `cpg-red-${size}-${percentage}`;

  const pctStr = `${percentage}%`;
  const fontSize  = targetLabel ? 15 : (pctStr.length > 3 ? Math.round(size * 0.13) : Math.round(size * 0.155));
  // Text transitions from green to red as you go from 100% to 200%
  const textColor = percentage <= 100 ? '#065f46' : '#dc2626';

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        className="absolute inset-0"
        style={{ transform: 'rotate(-90deg)' }}
      >
        <defs>
          {/* Green gradient */}
          <linearGradient id={greenGradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4ade80" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
          {/* Red gradient */}
          <linearGradient id={redGradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f87171" />
            <stop offset="100%" stopColor="#dc2626" />
          </linearGradient>
        </defs>
        {/* Track */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="#e5e7eb" strokeWidth={strokeWidth}
          opacity="0.3"
        />
        {/* Green arc — fills 0-100%, stays at 100% */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke={`url(#${greenGradId})`}
          strokeWidth={strokeWidth}
          strokeDasharray={circum}
          strokeDashoffset={greenOffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
        {/* Red arc — overlays from 100-200%, stays at 100% beyond */}
        {percentage > 100 && (
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none"
            stroke={`url(#${redGradId})`}
            strokeWidth={strokeWidth}
            strokeDasharray={circum}
            strokeDashoffset={redOffset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.5s ease' }}
          />
        )}
      </svg>
      <div className="relative flex flex-col items-center justify-center leading-none gap-0.5">
        <span className="font-bold" style={{ fontSize, color: textColor }}>
          {pctStr}
        </span>
        {targetLabel && (
          <span style={{ fontSize: 8, color: textColor, opacity: 0.85, fontWeight: 600 }}>
            of {targetLabel}
          </span>
        )}
      </div>
    </div>
  );
};

export default CircularProgress;
