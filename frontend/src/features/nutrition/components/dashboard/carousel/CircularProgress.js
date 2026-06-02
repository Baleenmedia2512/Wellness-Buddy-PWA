import React from 'react';

/**
 * CircularProgress — Circular progress ring for nutrition metrics.
 * @param {number} percentage - Progress percentage (0-100)
 * @param {string} color - Tailwind gradient class (e.g., 'from-emerald-400 to-teal-500')
 * @param {number} size - Diameter in pixels (default: 48)
 * @param {number} strokeWidth - Ring thickness (default: 4)
 */

// Map Tailwind gradient classes to hex colors
const getGradientColors = (colorClass) => {
  const colorMap = {
    // Protein - Blue to Indigo
    'from-blue-400 to-indigo-500': { start: '#60a5fa', end: '#6366f1' },
    // Fat - Yellow to Amber
    'from-yellow-400 to-amber-500': { start: '#facc15', end: '#f59e0b' },
    // Carbs - Orange to Amber
    'from-orange-400 to-amber-400': { start: '#fb923c', end: '#fbbf24' },
    // Sodium - Rose to Pink
    'from-rose-400 to-pink-500': { start: '#fb7185', end: '#ec4899' },
    // Cholesterol - Purple to Violet
    'from-purple-400 to-violet-500': { start: '#c084fc', end: '#8b5cf6' },
    // Sugar - Pink to Rose
    'from-pink-400 to-rose-400': { start: '#f472b6', end: '#fb7185' },
    // Fiber - Green to Emerald
    'from-green-400 to-emerald-500': { start: '#4ade80', end: '#10b981' },
    // Default - Emerald to Teal
    'from-emerald-400 to-teal-500': { start: '#34d399', end: '#14b8a6' },
  };
  
  return colorMap[colorClass] || colorMap['from-emerald-400 to-teal-500'];
};

const CircularProgress = ({ 
  percentage, 
  color = 'from-emerald-400 to-teal-500', 
  size = 48, 
  strokeWidth = 4 
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  const isOver = percentage >= 100;
  
  const gradientId = `gradient-${color.replace(/\s/g, '-')}-${size}`;
  const colors = getGradientColors(color);

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      {/* Background circle */}
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
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: isOver ? '#f87171' : colors.start, stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: isOver ? '#dc2626' : colors.end, stopOpacity: 1 }} />
        </linearGradient>
      </defs>
      {/* Progress circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-500 ease-out"
      />
    </svg>
  );
};

export default CircularProgress;
