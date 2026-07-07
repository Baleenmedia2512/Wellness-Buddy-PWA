import React from 'react';
import { X } from 'lucide-react';

const GI_ZONES = [
  {
    label: 'Low', range: '≤55',
    bgActive: 'bg-emerald-100 border border-emerald-300', bgInactive: 'bg-emerald-50',
    textActive: 'text-emerald-800', textInactive: 'text-emerald-600',
    isActive: (gi) => gi <= 55,
  },
  {
    label: 'Med', range: '56–69',
    bgActive: 'bg-amber-100 border border-amber-300', bgInactive: 'bg-amber-50',
    textActive: 'text-amber-800', textInactive: 'text-amber-600',
    isActive: (gi) => gi > 55 && gi <= 69,
  },
  {
    label: 'High', range: '≥70',
    bgActive: 'bg-rose-100 border border-rose-300', bgInactive: 'bg-rose-50',
    textActive: 'text-rose-800', textInactive: 'text-rose-600',
    isActive: (gi) => gi >= 70,
  },
];

const getZoneMeta = (gi) => {
  if (gi <= 55) {
    return { zone: 'Low', zoneBg: 'bg-emerald-50', zoneText: 'text-emerald-700', zoneDescription: 'Excellent for blood sugar' };
  }
  if (gi <= 69) {
    return { zone: 'Medium', zoneBg: 'bg-amber-50', zoneText: 'text-amber-700', zoneDescription: 'Moderate blood sugar impact' };
  }
  return { zone: 'High', zoneBg: 'bg-rose-50', zoneText: 'text-rose-700', zoneDescription: 'May cause sugar spikes' };
};

/**
 * GlycemicIndexModal — Bottom sheet showing average GI with Low/Medium/High zones.
 */
const GlycemicIndexModal = ({ isOpen, onClose, averageGI, mealCount = 0 }) => {
  if (!isOpen) return null;

  const hasData = averageGI != null && mealCount > 0;
  const gi = hasData ? Math.round(averageGI) : null;
  const { zone, zoneBg, zoneText, zoneDescription } = hasData ? getZoneMeta(gi) : {};

  const size = 80;
  const sw = 7;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const pct = hasData ? Math.min(100, gi) : 0;
  const offset = circ - (pct / 100) * circ;
  const gradStart = !hasData ? '#e5e7eb' : gi <= 55 ? '#4ade80' : gi <= 69 ? '#fbbf24' : '#f87171';
  const gradEnd = !hasData ? '#d1d5db' : gi <= 55 ? '#059669' : gi <= 69 ? '#f59e0b' : '#dc2626';

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 z-[60]"
        onClick={onClose}
        style={{ animation: 'fadeIn 0.2s ease-out' }}
      />

      <div
        className="fixed bottom-0 left-0 right-0 z-[61] bg-white rounded-t-3xl shadow-2xl max-h-[75vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: 'slideUp 0.3s ease-out' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Glycemic Index</h2>
            {hasData && (
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-sm font-bold ${zoneText}`}>{gi}</span>
                <span className="text-sm text-gray-500">Avg GI</span>
                <span className={`text-xs font-semibold ${zoneBg} ${zoneText} px-2 py-0.5 rounded-full`}>
                  {zone}
                </span>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {!hasData ? (
            <div className="text-center py-8">
              <p className="text-sm text-gray-700 font-semibold mb-1">No meals logged</p>
              <p className="text-xs text-gray-500">Capture a meal to see your average GI</p>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              {/* Ring */}
              <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
                <svg width={size} height={size} className="transform -rotate-90">
                  <defs>
                    <linearGradient id={`gi-modal-grad-${gi}`} x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor={gradStart} />
                      <stop offset="100%" stopColor={gradEnd} />
                    </linearGradient>
                  </defs>
                  <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={sw} opacity="0.3" />
                  <circle
                    cx={size / 2} cy={size / 2} r={r} fill="none"
                    stroke={`url(#gi-modal-grad-${gi})`} strokeWidth={sw}
                    strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`text-3xl font-extrabold leading-none ${zoneText}`}>{gi}</span>
                  <span className="text-[10px] text-gray-500 mt-0.5">Avg GI</span>
                </div>
              </div>

              {/* Zone info + columns */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-bold ${zoneText} mb-0.5`}>{zone} GI Zone</p>
                <p className="text-xs text-gray-500 mb-3 leading-tight">{zoneDescription}</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {GI_ZONES.map(({ label, range, bgActive, bgInactive, textActive, textInactive, isActive }) => {
                    const active = isActive(gi);
                    return (
                      <div
                        key={label}
                        className={`text-center py-1.5 rounded-md ${active ? bgActive : bgInactive}`}
                      >
                        <p className={`text-[10px] font-semibold ${active ? textActive : textInactive}`}>{label}</p>
                        <p className="text-[9px] text-gray-500">{range}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
          <p className="text-[10px] text-gray-400 text-center">
            {hasData
              ? `Carb-weighted avg · ${mealCount} meal${mealCount !== 1 ? 's' : ''} today`
              : 'Low ≤55 · Medium 56–69 · High ≥70'}
          </p>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </>
  );
};

export default GlycemicIndexModal;
