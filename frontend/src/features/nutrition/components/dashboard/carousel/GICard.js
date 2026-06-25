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
      <div className="h-full flex items-center justify-center py-2">
        <div className="bg-white rounded-xl shadow-lg p-3 w-full">
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center shadow-md">
                <Activity className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-base font-bold text-gray-900">Glycemic Index</span>
            </div>
            <span className="text-[10px] font-semibold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">No Data</span>
          </div>
          {/* Empty state */}
          <div className="flex items-center justify-between">
            <div className="w-[70px] h-[70px] rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
              <Activity className="w-7 h-7 text-gray-300" />
            </div>
            <div className="flex-1 pl-3">
              <p className="text-xs text-gray-700 font-semibold mb-0.5">No meals logged</p>
              <p className="text-[10px] text-gray-500 leading-relaxed">
                Capture a meal to see your average GI
              </p>
            </div>
          </div>
          <p className="text-[9px] text-gray-400 text-center mt-2 pt-1.5 border-t border-gray-100">
            Low ≤55 · Medium 56–69 · High ≥70
          </p>
        </div>
      </div>
    );
  }

  const gi = Math.round(averageGI);
  let zone, zoneBg, zoneText, zoneDescription;
  if (gi <= 55) {
    zone = 'Low'; zoneBg = 'bg-emerald-50'; zoneText = 'text-emerald-700'; zoneDescription = 'Excellent for blood sugar';
  } else if (gi <= 69) {
    zone = 'Medium'; zoneBg = 'bg-amber-50'; zoneText = 'text-amber-700'; zoneDescription = 'Moderate blood sugar impact';
  } else {
    zone = 'High'; zoneBg = 'bg-rose-50'; zoneText = 'text-rose-700'; zoneDescription = 'May cause sugar spikes';
  }

  const size = 70;
  const sw = 7;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(100, gi);
  const offset = circ - (pct / 100) * circ;

  return (
    <div className="h-full flex items-center justify-center py-2">
      <div className="bg-white rounded-xl shadow-lg p-3 w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center shadow-md">
              <Activity className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-base font-bold text-gray-900">Glycemic Index</span>
          </div>
          <span className={`text-[10px] font-semibold ${zoneBg} ${zoneText} px-2 py-0.5 rounded-full`}>
            {zone}
          </span>
        </div>

        {/* Main — ring left, stats right */}
        <div className="flex items-center justify-between mb-2">
          {/* Ring */}
          <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="transform -rotate-90">
              <defs>
                <linearGradient id={`gi-grad-${gi}`} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={gi <= 55 ? '#4ade80' : gi <= 69 ? '#fbbf24' : '#f87171'} />
                  <stop offset="100%" stopColor={gi <= 55 ? '#059669' : gi <= 69 ? '#f59e0b' : '#dc2626'} />
                </linearGradient>
              </defs>
              <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={sw} opacity="0.3" />
              <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={`url(#gi-grad-${gi})`} strokeWidth={sw}
                strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-2xl font-extrabold leading-none ${zoneText}`}>{gi}</span>
              <span className="text-[9px] text-gray-500 mt-0.5">Avg GI</span>
            </div>
          </div>
          {/* Stats */}
          <div className="flex-1 pl-3">
            <p className={`text-xs font-bold ${zoneText} mb-0.5`}>{zone} GI Zone</p>
            <p className="text-[10px] text-gray-500 mb-1.5 leading-tight">{zoneDescription}</p>
            <div className="grid grid-cols-3 gap-1">
              {[['Low','≤55', gi <= 55, 'emerald'], ['Med','56–69', gi > 55 && gi <= 69, 'amber'], ['High','≥70', gi >= 70, 'rose']].map(([label, range, active, color]) => (
                <div key={label} className={`text-center py-1 rounded-md ${
                  active ? `bg-${color}-100 border border-${color}-300` : `bg-${color}-50`
                }`}>
                  <p className={`text-[9px] font-semibold text-${color}-${active ? '800' : '600'}`}>{label}</p>
                  <p className="text-[8px] text-gray-500">{range}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-[9px] text-gray-400 text-center pt-1.5 border-t border-gray-100">
          Carb-weighted avg · {mealCount} meal{mealCount !== 1 ? 's' : ''} today
        </p>
      </div>
    </div>
  );
};

export default GICard;
