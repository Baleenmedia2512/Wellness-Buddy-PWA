import React from 'react';
import { Activity, Wheat, Candy, Leaf } from 'lucide-react';
import CircularProgress from './CircularProgress';

const getGIZone = (gi) => {
  if (gi <= 55) return { label: 'Low', text: 'text-emerald-700' };
  if (gi <= 69) return { label: 'Med', text: 'text-amber-700' };
  return { label: 'High', text: 'text-rose-700' };
};

const GIRing = ({ gi, size = 70 }) => {
  const sw = 6;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(100, gi);
  const offset = circ - (pct / 100) * circ;
  const zoneText = gi <= 55 ? 'text-emerald-700' : gi <= 69 ? 'text-amber-700' : 'text-rose-700';
  const gradStart = gi <= 55 ? '#4ade80' : gi <= 69 ? '#fbbf24' : '#f87171';
  const gradEnd = gi <= 55 ? '#059669' : gi <= 69 ? '#f59e0b' : '#dc2626';

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0 transform -rotate-90">
        <defs>
          <linearGradient id={`lowcarb-gi-grad-${gi}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={gradStart} />
            <stop offset="100%" stopColor={gradEnd} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={sw} opacity="0.3" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={`url(#lowcarb-gi-grad-${gi})`} strokeWidth={sw}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <div className="relative flex flex-col items-center justify-center leading-none gap-0.5">
        <span className={`font-bold text-[15px] ${zoneText}`}>{gi}</span>
        <span className="text-[8px] text-gray-500 font-semibold opacity-85">Avg GI</span>
      </div>
    </div>
  );
};

/**
 * LowCarbCard — Card 4 of the Nutrition Carousel.
 * Compact MyFitnessPal-style with GI, sugar, and fiber side by side.
 */
const LowCarbCard = ({ carbs, sugar, fiber, glycemicIndex, onOpenModal }) => {
  const sugarPct = Math.round((sugar.consumed / sugar.target) * 100);
  const fiberPct = Math.round(((fiber.consumed || 0) / fiber.target) * 100);
  const gi = glycemicIndex != null ? Math.round(glycemicIndex) : null;
  const giZone = gi != null ? getGIZone(gi) : null;

  return (
    <div className="h-full flex items-center justify-center py-2">
      <div className="bg-white rounded-xl shadow-lg p-2.5 w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center shadow-md">
              <Wheat className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold text-gray-900">Glucose-friendly</span>
          </div>
        </div>

        {/* 3 Nutrients in a Row — GI, Sugar, Fiber */}
        <div className="grid grid-cols-3 gap-4">
          {/* Glycemic Index */}
          <div
            className={`text-center ${onOpenModal ? 'cursor-pointer active:scale-95 transition-transform' : ''}`}
            onClick={() => onOpenModal && onOpenModal('glycemicIndex')}
            role={onOpenModal ? 'button' : undefined}
            tabIndex={onOpenModal ? 0 : undefined}
            onKeyPress={onOpenModal ? (e) => { if (e.key === 'Enter' || e.key === ' ') onOpenModal('glycemicIndex'); } : undefined}
          >
            {gi != null ? (
              <GIRing gi={gi} size={70} />
            ) : (
              <div className="w-[70px] h-[70px] mx-auto rounded-full bg-gray-100 flex items-center justify-center">
                <Activity className="w-5 h-5 text-gray-400" />
              </div>
            )}
            <div className="mt-1.5">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Activity className="w-3.5 h-3.5 text-indigo-500" />
                <p className="text-xs font-semibold text-gray-700">GI</p>
              </div>
              {giZone ? (
                <>
                  <p className={`text-sm font-bold ${giZone.text}`}>{giZone.label}</p>
                  <p className="text-[10px] text-gray-500">Avg · {gi}</p>
                </>
              ) : (
                <p className="text-[9px] text-gray-400">No data</p>
              )}
            </div>
          </div>

          {/* Sugar */}
          <div className="text-center">
            <CircularProgress 
              percentage={sugarPct} 
              color="from-pink-400 to-rose-400" 
              size={70} 
              strokeWidth={6} 
              targetLabel={`${sugar.target}g`} 
              onClick={() => onOpenModal && onOpenModal('sugar')}
            />
            <div className="mt-1.5">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Candy className="w-3.5 h-3.5 text-pink-500" />
                <p className="text-xs font-semibold text-gray-700">Sugar</p>
              </div>
              <p className="text-sm font-bold text-gray-900">{sugar.consumed}g</p>
              <p className="text-[10px] text-gray-500">/ {sugar.target}g</p>
            </div>
          </div>

          {/* Fiber (goal, not limit) */}
          <div className="text-center">
            <CircularProgress 
              percentage={fiberPct} 
              color="from-green-400 to-emerald-500" 
              size={70} 
              strokeWidth={6} 
              targetLabel={`${fiber.target}g`} 
              onClick={() => onOpenModal && onOpenModal('fiber')}
            />
            <div className="mt-1.5">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Leaf className="w-3.5 h-3.5 text-green-600" />
                <p className="text-xs font-semibold text-gray-700">Fiber</p>
              </div>
              <p className="text-sm font-bold text-gray-900">{fiber.consumed}g</p>
              <p className="text-[10px] text-gray-500">/ {fiber.target}g</p>
              {fiber.consumed >= fiber.target && (
                <p className="text-[9px] text-emerald-600 font-semibold">Goal! ✓</p>
              )}
            </div>
          </div>
        </div>

        {/* Footer — carbs summary */}
       <p className="text-[10px] text-gray-400 text-center mt-2 pt-2 border-t border-gray-100">
  {carbs.target != null
    ? 'Track sugar & fiber goals'
    : 'Track your carb intake goals'}
</p>
      </div>
    </div>
  );
};

export default LowCarbCard;
