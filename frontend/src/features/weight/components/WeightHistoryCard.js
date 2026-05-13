/**
 * WeightHistoryCard.js — presentational.
 *
 * Modern history-list row with swipe-to-delete. All gesture state lives in
 * `useSwipeToDelete`; all formatting lives in `weightFormService`. This file
 * is render-only.
 */
import React from 'react';
import BathroomScaleIcon from '../../../shared/components/icons/BathroomScaleIcon';
import { useSwipeToDelete } from '../hooks/useSwipeToDelete';
import { formatHistoryDate, computeWeightDiff } from '../services/weightFormService';

const WeightHistoryCard = React.memo(function WeightHistoryCard({
  data, onDelete, onView, previousWeight = null,
}) {
  const swipe = useSwipeToDelete({ onDelete: () => onDelete?.(data) });

  if (!data || !data.Weight || !data.CreatedAt) {
    // eslint-disable-next-line no-console
    console.warn('WeightHistoryCard received invalid data:', data);
    return null;
  }

  const diff = computeWeightDiff(data.Weight, previousWeight);

  return (
    <div
      className="relative w-full"
      style={{ touchAction: swipe.dragging ? 'none' : 'pan-y', minHeight: 80, animation: 'slideInUp 0.2s ease-out both' }}
    >
      {/* Swipe-delete background */}
      <div aria-hidden className="absolute inset-0 z-0 flex items-center justify-end pr-5 overflow-hidden rounded-2xl">
        <div
          className="flex items-center justify-center w-12 h-12 bg-red-500 rounded-full"
          style={{
            opacity: swipe.progress,
            transform: `scale(${0.6 + swipe.progress * 0.4})`,
            transition: swipe.dragging ? 'none' : 'transform 160ms ease, opacity 160ms ease',
          }}
        >
          <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            style={{ transform: `rotate(${swipe.armed ? 10 : 0}deg)`, transition: 'transform 160ms cubic-bezier(.2,.8,.2,1.2)', strokeWidth: swipe.armed ? 2.2 : 2 }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
          </svg>
        </div>
      </div>

      {/* Card */}
      <div
        ref={swipe.elRef}
        role="button"
        aria-label={`Weight: ${data.Weight} kg`}
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' && !swipe.leaving) onView?.(data); }}
        {...swipe.touchHandlers}
        {...swipe.pointerHandlers}
        onClick={() => { if (!swipe.dragging && Math.abs(swipe.dx) < 5 && !swipe.leaving) onView?.(data); }}
        className={`relative z-10 bg-white rounded-2xl select-none cursor-pointer overflow-hidden ${swipe.leaving ? 'pointer-events-none' : ''}`}
        style={{
          transform: `translateX(${swipe.dx}px) scale(${swipe.scale})`,
          transition: swipe.animating ? 'transform 180ms cubic-bezier(.2,.8,.2,1.1)' : 'none',
          willChange: 'transform',
          boxShadow: '0 1px 4px rgba(0,0,0,0.07), 0 4px 16px rgba(0,0,0,0.05)',
          border: '1px solid rgba(0,0,0,0.06)',
        }}
      >
        <div className="absolute bottom-0 left-0 h-0.5 bg-red-500 rounded-b-2xl"
          style={{ width: `${swipe.progress * 100}%`, transition: swipe.dragging ? 'none' : 'width 180ms ease', opacity: swipe.progress > 0 ? 1 : 0 }} />

        <div className="p-3 flex items-center gap-3">
          <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center shadow-sm">
            <BathroomScaleIcon className="w-9 h-9 text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-lg font-bold text-gray-900 leading-none">
                {parseFloat(data.Weight).toFixed(2)}
              </span>
              <span className="text-xs text-gray-400 font-medium">kg</span>
              {diff && (
                <span className={`text-xs font-semibold ${diff.gained ? 'text-red-500' : 'text-green-500'}`}>
                  {diff.arrow} {diff.abs.toFixed(1)} kg
                </span>
              )}
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5 truncate">{formatHistoryDate(data.CreatedAt)}</p>
          </div>
          <div className="shrink-0 flex flex-col items-center justify-center bg-emerald-50 rounded-xl px-3 py-2 min-w-[52px]">
            <span className="text-lg font-extrabold text-emerald-600 leading-none">
              {parseFloat(data.Weight).toFixed(2)}
            </span>
            <span className="text-[10px] text-emerald-400 font-medium mt-0.5">kg</span>
          </div>
        </div>
      </div>
    </div>
  );
});

export default WeightHistoryCard;
