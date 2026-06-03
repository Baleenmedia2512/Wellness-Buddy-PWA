import React from 'react';

/**
 * CircularProgress — Circular progress ring for nutrition metrics.
 *
 * Two-layer color system:
 *   0–100%  : green gradient fills the ring
 *   100%+   : green stays at 100%, red arc overlays showing excess
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
  
  // Green arc: always capped at 100%
  const greenPct = Math.min(percentage, 100);
  const greenOffset = circum - (greenPct / 100) * circum;
  
  // Red arc: only shows excess beyond 100%
  const isExceeding = percentage > 100;
  const excessPct = isExceeding ? percentage - 100 : 0;
  const redOffset = circum - (excessPct / 100) * circum;
  
  // Unique gradient ids
  const greenGradId = `cpg-green-${size}-${percentage}`;
  const redGradId = `cpg-red-${size}-${percentage}`;
  
  const pctStr = `${percentage}%`;
  const fontSize  = targetLabel ? 15 : (pctStr.length > 3 ? Math.round(size * 0.13) : Math.round(size * 0.155));
  const textColor = isExceeding ? '#dc2626' : '#065f46';

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
        {/* Green arc (base, up to 100%) */}
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
        {/* Red arc (excess, only when > 100%) */}
        {isExceeding && (
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
