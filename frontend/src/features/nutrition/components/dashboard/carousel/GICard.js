import React from 'react';
import { Activity } from 'lucide-react';

/**
 * GICard — Card 5 of the Nutrition Carousel.
 * Shows average Glycemic Index consumed today with color-coded zones:
 *   Low: ≤55 (green) — Good for blood sugar control
 *   Medium: 56-69 (amber) — Moderate impact
 *   High: ≥70 (red) — Rapid blood sugar spike
 */
const GICard = ({ averageGI, mealCount }) => {
  if (averageGI == null || mealCount === 0) {
    return (
      <div className="h-full flex items-start justify-center pt-2 px-3">
        <div className="bg-white rounded-2xl shadow-lg p-4 w-full max-w-md">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center shadow-md">
                <Activity className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-bold text-gray-900">Glycemic Index</span>
            </div>
            <span className="text-xs font-semibold bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">No Data</span>
          </div>

          {/* Empty state */}
          <div className="flex flex-col items-center justify-center py-6">
            <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-3">
              <Activity className="w-10 h-10 text-gray-400" />
            </div>
            <p className="text-sm text-gray-700 font-semibold mb-1">No meals logged today</p>
            <p className="text-xs text-gray-500 text-center px-6 leading-relaxed">
              Capture a meal to see your average Glycemic Index
            </p>
          </div>

          {/* Footer */}
          <p className="text-[10px] text-gray-400 text-center mt-2 pt-3 border-t border-gray-100">
            Low ≤55 · Medium 56-69 · High ≥70
          </p>
        </div>
      </div>
    );
  }

  // Determine zone and styling
  const gi = Math.round(averageGI);
  let zone, zoneBg, zoneText, zoneGradient, zoneBorder, zoneDescription;

  if (gi <= 55) {
    zone = 'Low';
    zoneBg = 'bg-emerald-50';
    zoneText = 'text-emerald-700';
    zoneGradient = 'from-emerald-400 to-green-500';
    zoneBorder = 'border-emerald-200';
    zoneDescription = 'Excellent for blood sugar control';
  } else if (gi <= 69) {
    zone = 'Medium';
    zoneBg = 'bg-amber-50';
    zoneText = 'text-amber-700';
    zoneGradient = 'from-amber-400 to-orange-400';
    zoneBorder = 'border-amber-200';
    zoneDescription = 'Moderate impact on blood sugar';
  } else {
    zone = 'High';
    zoneBg = 'bg-rose-50';
    zoneText = 'text-rose-700';
    zoneGradient = 'from-rose-400 to-red-500';
    zoneBorder = 'border-rose-200';
    zoneDescription = 'May cause blood sugar spikes';
  }

  // Percentage for circular progress: map GI 0-100 → 0-100%
  const percentage = Math.min(100, gi);

  return (
    <div className="h-full flex items-start justify-center pt-2 px-3">
      <div className="bg-white rounded-2xl shadow-lg p-4 w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center shadow-md">
              <Activity className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold text-gray-900">Glycemic Index</span>
          </div>
          <span className={`text-xs font-semibold ${zoneBg} ${zoneText} px-2.5 py-1 rounded-full`}>
            {zone}
          </span>
        </div>

        {/* Main Content — Circular Progress */}
        <div className="flex items-center justify-center mb-3">
          <div className="relative inline-flex items-center justify-center" style={{ width: 120, height: 120 }}>
            {/* SVG Ring */}
            <svg
              width={120}
              height={120}
              className="absolute inset-0"
              style={{ transform: 'rotate(-90deg)' }}
            >
              <defs>
                <linearGradient id={`gi-gradient-${gi}`} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style={{ stopColor: zone === 'High' ? '#f87171' : zone === 'Medium' ? '#fbbf24' : '#4ade80', stopOpacity: 1 }} />
                  <stop offset="100%" style={{ stopColor: zone === 'High' ? '#dc2626' : zone === 'Medium' ? '#f59e0b' : '#059669', stopOpacity: 1 }} />
                </linearGradient>
              </defs>
              {/* Background track */}
              <circle
                cx={60}
                cy={60}
                r={50}
                fill="none"
                stroke="#E5E7EB"
                strokeWidth={10}
              />
              {/* Progress arc */}
              <circle
                cx={60}
                cy={60}
                r={50}
                fill="none"
                stroke={`url(#gi-gradient-${gi})`}
                strokeWidth={10}
                strokeDasharray={2 * Math.PI * 50}
                strokeDashoffset={2 * Math.PI * 50 - (percentage / 100) * 2 * Math.PI * 50}
                strokeLinecap="round"
                className="transition-all duration-500 ease-out"
              />
            </svg>
            {/* Center label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className={`text-5xl font-extrabold leading-none ${zoneText}`}>{gi}</p>
              <p className="text-xs text-gray-500 mt-1">Average GI</p>
            </div>
          </div>
        </div>

        {/* Zone Description */}
        <div className={`border ${zoneBorder} rounded-lg p-2.5 mb-3 ${zoneBg}`}>
          <p className={`text-sm font-bold ${zoneText} mb-1`}>{zone} GI Zone</p>
          <p className="text-xs text-gray-600">{zoneDescription}</p>
        </div>

        {/* GI Scale Reference */}
        <div className="grid grid-cols-3 gap-2 mb-2">
          <div className={`text-center py-2 px-1 rounded-lg ${gi <= 55 ? 'bg-emerald-100 border-2 border-emerald-300' : 'bg-emerald-50'}`}>
            <p className={`text-xs font-semibold ${gi <= 55 ? 'text-emerald-800' : 'text-emerald-600'}`}>Low</p>
            <p className="text-[10px] text-gray-600 mt-0.5">≤55</p>
          </div>
          <div className={`text-center py-2 px-1 rounded-lg ${gi > 55 && gi <= 69 ? 'bg-amber-100 border-2 border-amber-300' : 'bg-amber-50'}`}>
            <p className={`text-xs font-semibold ${gi > 55 && gi <= 69 ? 'text-amber-800' : 'text-amber-600'}`}>Medium</p>
            <p className="text-[10px] text-gray-600 mt-0.5">56-69</p>
          </div>
          <div className={`text-center py-2 px-1 rounded-lg ${gi >= 70 ? 'bg-rose-100 border-2 border-rose-300' : 'bg-rose-50'}`}>
            <p className={`text-xs font-semibold ${gi >= 70 ? 'text-rose-800' : 'text-rose-600'}`}>High</p>
            <p className="text-[10px] text-gray-600 mt-0.5">≥70</p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-[10px] text-gray-400 text-center pt-2 border-t border-gray-100">
          Carb-weighted average from all meals
        </p>
      </div>
    </div>
  );
};

export default GICard;
