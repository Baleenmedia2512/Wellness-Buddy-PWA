import React from 'react';
import { Activity, Beef, Droplet } from 'lucide-react';
import CircularProgress from './CircularProgress';

const getGIZone = (gi) => {
  if (gi <= 55) return { label: 'Low', text: 'text-emerald-700' };
  if (gi <= 69) return { label: 'Med', text: 'text-amber-700' };
  return { label: 'High', text: 'text-rose-700' };
};

const GIRing = ({ gi, size = 60 }) => {
  const sw = 5;
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
          <linearGradient id={`macros-gi-grad-${gi}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={gradStart} />
            <stop offset="100%" stopColor={gradEnd} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={sw} opacity="0.3" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={`url(#macros-gi-grad-${gi})`} strokeWidth={sw}
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
 * MacrosCard — Card 2 of the Nutrition Carousel.
 * Compact MyFitnessPal-style with GI, fat, and protein side by side.
 */
const MacrosCard = ({ 
  consumedProtein, 
  consumedFat, 
  proteinTarget, 
  fatTarget, 
  glycemicIndex,
  onOpenModal,
}) => {
  const hasTargets = proteinTarget != null;
  const gi = glycemicIndex != null ? Math.round(glycemicIndex) : null;
  
  const proteinPct = hasTargets && proteinTarget > 0 ? Math.round((consumedProtein / proteinTarget) * 100) : null;
  const fatPct = hasTargets && fatTarget > 0 ? Math.round((consumedFat / fatTarget) * 100) : null;
  const giZone = gi != null ? getGIZone(gi) : null;

  return (
    <div className="h-full flex items-center justify-center py-2">
      <div className="bg-white rounded-xl shadow-lg p-3 w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center shadow-md">
              <Beef className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-base font-bold text-gray-900">Macros</span>
          </div>
          {!hasTargets && (
            <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
              Log weight
            </span>
          )}
        </div>

        {/* 3 columns — order: Glycemic Index, Fat, Protein */}
        <div className="grid grid-cols-3 gap-3">
          {/* Glycemic Index */}
          <div
            className={`text-center ${onOpenModal ? 'cursor-pointer active:scale-[0.98] transition-transform' : ''}`}
            onClick={() => onOpenModal && onOpenModal('glycemicIndex')}
            role={onOpenModal ? 'button' : undefined}
            tabIndex={onOpenModal ? 0 : undefined}
            onKeyPress={onOpenModal ? (e) => { if (e.key === 'Enter' || e.key === ' ') onOpenModal('glycemicIndex'); } : undefined}
          >
            {gi != null ? (
              <GIRing gi={gi} size={60} />
            ) : (
              <div className="w-[60px] h-[60px] mx-auto rounded-full bg-gray-100 flex items-center justify-center">
                <span className="text-xs text-gray-400 font-medium">?</span>
              </div>
            )}
            <div className="mt-1">
              <div className="flex items-center justify-center gap-0.5 mb-0.5">
                <Activity className="w-3 h-3 text-indigo-500" />
                <p className="text-[10px] font-semibold text-gray-700">GI</p>
              </div>
              {giZone ? (
                <>
                  <p className={`text-xs font-bold ${giZone.text}`}>{giZone.label}</p>
                  <p className="text-[9px] text-gray-500">Avg · {gi}</p>
                </>
              ) : (
                <p className="text-[8px] text-gray-400">No data</p>
              )}
            </div>
          </div>

          {/* Fat */}
          <div className="text-center">
            {fatPct != null ? (
              <CircularProgress 
                percentage={fatPct} 
                color="from-yellow-400 to-amber-500" 
                size={60} 
                strokeWidth={5} 
                targetLabel={fatTarget != null ? `${fatTarget}g` : undefined}
                onClick={() => onOpenModal && onOpenModal('fat')}
              />
            ) : (
              <div className="w-[60px] h-[60px] mx-auto rounded-full bg-gray-100 flex items-center justify-center">
                <span className="text-xs text-gray-400 font-medium">?</span>
              </div>
            )}
            <div className="mt-1">
              <div className="flex items-center justify-center gap-0.5 mb-0.5">
                <Droplet className="w-3 h-3 text-yellow-500" />
                <p className="text-[10px] font-semibold text-gray-700">Fat</p>
              </div>
              <p className="text-xs font-bold text-gray-900">{Math.round(consumedFat || 0)}g</p>
              {hasTargets && <p className="text-[9px] text-gray-500">/ {fatTarget}g</p>}
              {!hasTargets && <p className="text-[8px] text-amber-600">No target</p>}
            </div>
          </div>

          {/* Protein */}
          <div className="text-center">
            {proteinPct != null ? (
              <CircularProgress 
                percentage={proteinPct} 
                color="from-blue-400 to-indigo-500" 
                size={60} 
                strokeWidth={5} 
                targetLabel={proteinTarget != null ? `${proteinTarget}g` : undefined}
                onClick={() => onOpenModal && onOpenModal('protein')}
              />
            ) : (
              <div className="w-[60px] h-[60px] mx-auto rounded-full bg-gray-100 flex items-center justify-center">
                <span className="text-xs text-gray-400 font-medium">?</span>
              </div>
            )}
            <div className="mt-1">
              <div className="flex items-center justify-center gap-0.5 mb-0.5">
                <Beef className="w-3 h-3 text-blue-500" />
                <p className="text-[10px] font-semibold text-gray-700">Protein</p>
              </div>
              <p className="text-xs font-bold text-gray-900">{Math.round(consumedProtein || 0)}g</p>
              {hasTargets && <p className="text-[9px] text-gray-500">/ {proteinTarget}g</p>}
              {!hasTargets && <p className="text-[8px] text-amber-600">No target</p>}
            </div>
          </div>
        </div>

        {/* Footer */}
        {hasTargets && (
          <p className="text-[9px] text-gray-400 text-center mt-1.5 pt-1.5 border-t border-gray-100">
            Targets based on your weight
          </p>
        )}

      </div>
    </div>
  );
};

export default MacrosCard;
