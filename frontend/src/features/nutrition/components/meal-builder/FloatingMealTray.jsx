/**
 * Compact sticky meal tray — keep search usable while building a meal.
 * Thumbs + +N | Edit (opens sheet) | Save Meal
 */
import React from 'react';
import { ChevronUp } from 'lucide-react';
import { FoodThumb } from './FoodThumb';

const PREVIEW_COUNT = 3;

export function saveMealLabel(count) {
  const n = Number(count) || 0;
  if (n <= 1) return 'Save Meal';
  return `Save ${n} Items`;
}

export default function FloatingMealTray({
  items = [],
  totalKcal = 0,
  onOpenSheet,
  onSave,
  onClear,
  className = '',
}) {
  const count = items.length;
  if (count === 0) return null;

  const preview = items.slice(0, PREVIEW_COUNT);
  const overflow = count - PREVIEW_COUNT;

  return (
    <div
      className={`safe-area-pb border-t border-green-100 bg-white/95 backdrop-blur-sm shadow-[0_-6px_24px_rgba(0,0,0,0.08)] ${className}`}
      role="region"
      aria-label={`Meal selection, ${count} item${count === 1 ? '' : 's'}`}
    >
      <div className="px-3 pt-2 pb-2 flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenSheet}
          className="flex items-center gap-2.5 flex-1 min-w-0 rounded-xl bg-green-50 border border-green-100 px-2.5 py-2 text-left active:bg-green-100"
          aria-label={`Review meal, ${count} items. Edit quantities`}
        >
          <div className="flex items-center -space-x-2 flex-shrink-0">
            {preview.map((item) => (
              <FoodThumb key={item.name} name={item.name} size="sm" className="!ring-white" />
            ))}
            {overflow > 0 && (
              <div className="w-8 h-8 rounded-xl bg-green-200 text-green-900 text-[11px] font-bold flex items-center justify-center ring-2 ring-white">
                +{overflow}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-gray-900 truncate">
              Your Meal · {count} item{count === 1 ? '' : 's'}
            </p>
            <p className="text-[11px] text-green-700 font-semibold">
              {totalKcal} kcal · Edit qty
            </p>
          </div>
          <ChevronUp className="w-4 h-4 text-green-700 flex-shrink-0" aria-hidden />
        </button>

        <div className="flex flex-col items-center flex-shrink-0">
          <button
            type="button"
            onClick={onSave}
            className="px-3.5 py-2 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white text-xs font-bold rounded-xl shadow-sm text-center"
          >
            {saveMealLabel(count)}
          </button>
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              className="mt-1 px-2.5 py-0.5 text-xs font-bold text-red-600 hover:text-red-700 active:text-red-800 bg-red-50 hover:bg-red-100 rounded-lg transition-colors border border-red-200/60"
            >
              Clear all
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
