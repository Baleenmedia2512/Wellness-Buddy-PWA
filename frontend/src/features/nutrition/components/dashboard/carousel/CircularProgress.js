import React from 'react';

/**
 * CircularProgress — Circular progress ring for nutrition metrics.
 *
 * Unified color scheme (all nutrients):
 *   0–100%   : green gradient (lime-400 → emerald-500)
 *   100–150% : yellow/amber gradient — arc restarts from 0 (second lap)
 *   150%+    : red gradient — ring fully filled
 *
 * A percentage label is always rendered in the centre of the ring.
 *
 * @param {number} percentage   Actual percentage (unclamped, may exceed 100)
 * @param {number} size         Diameter in px (default 70)
 * @param {number} strokeWidth  Ring thickness in px (default 6)
 */

// Zone colours — intentional gradient pairs for a premium look
const ZONE_COLORS = {
  normal: { start: '#4ade80', end: '#059669' }, // lime-400 → emerald-600
  yellow: { start: '#fde047', end: '#f59e0b' }, // yellow-300 → amber-500
  red:    { start: '#f87171', end: '#dc2626' }, // red-400 → red-600
};

function resolveZone(pct) {
  if (pct > 150) return 'red';
  if (pct > 100) return 'yellow';
  return 'normal';
}

function resolveArcPct(pct, zone) {
  if (zone === 'red')    return 100;
  if (zone === 'yellow') return ((pct - 100) / 50) * 100;
  return pct;
}

const CircularProgress = ({
  percentage,
  size = 70,
  strokeWidth = 6,
  targetLabel,
}) => {
  const zone   = resolveZone(percentage);
  const arcPct = resolveArcPct(percentage, zone);
  const colors = ZONE_COLORS[zone];
  const radius = (size - strokeWidth) / 2;
  const circum = 2 * Math.PI * radius;
  const offset = circum - (arcPct / 100) * circum;
  // Unique gradient id per element to avoid SVG id collisions in lists
  const gradId = `cpg-${zone}-${size}-${percentage}`;
  const pctStr = `${percentage}%`;
  // If targetLabel provided: use fixed 15px. Otherwise auto-size to fit ring.
  const fontSize  = targetLabel ? 15 : (pctStr.length > 3 ? Math.round(size * 0.13) : Math.round(size * 0.155));
  const textColor = zone === 'red' ? '#dc2626' : zone === 'yellow' ? '#d97706' : '#065f46';

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
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   style={{ stopColor: colors.start, stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: colors.end,   stopOpacity: 1 }} />
          </linearGradient>
        </defs>
        {/* Track */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="#E5E7EB" strokeWidth={strokeWidth}
        />
        {/* Progress arc */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={strokeWidth}
          strokeDasharray={circum}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500 ease-out"
        />
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
