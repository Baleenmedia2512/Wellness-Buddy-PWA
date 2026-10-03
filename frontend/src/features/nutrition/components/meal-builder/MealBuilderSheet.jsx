/**
 * Meal Builder bottom sheet — edit qty, macros summary, clear, save.
 */
import React, { useEffect } from 'react';
import { X, Minus, Plus } from 'lucide-react';
import { FoodThumb } from './FoodThumb';
import MealBowlIcon from './MealBowlIcon';
import { saveMealLabel } from './FloatingMealTray';

/** Half-serving steps: 0.5, 1, 1.5, … */
const QTY_STEP = 0.5;
const QTY_MIN = 0.5;

function snapHalfServing(n) {
  return Math.round(n * 2) / 2;
}

function formatQtyDisplay(n) {
  const snapped = snapHalfServing(n);
  return Number.isInteger(snapped) ? String(snapped) : snapped.toFixed(1);
}

export default function MealBuilderSheet({
  open,
  items = [],
  totalKcal = 0,
  macroSummary = null,
  onClose,
  onSave,
  onClear,
  onRemove,
  onQuantityChange,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const count = items.length;
  const protein = Math.round(macroSummary?.protein ?? 0);
  const carbs = Math.round(macroSummary?.carbs ?? 0);
  const fat = Math.round(macroSummary?.fat ?? 0);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close meal builder"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Your Meal"
        className="relative bg-white rounded-t-2xl shadow-2xl max-h-[78vh] flex flex-col w-full max-w-lg mx-auto"
      >
        <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <MealBowlIcon size={28} />
            <div>
              <p className="text-sm font-bold text-gray-900">Your Meal</p>
              <p className="text-[11px] text-gray-400">
                {count} item{count === 1 ? '' : 's'} · {totalKcal} kcal
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onClear}
              className="px-2 py-1 text-xs font-semibold text-green-700 hover:text-green-800"
            >
              Clear all
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-gray-100"
              aria-label="Close"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {items.map((item) => {
            const countSrv = Number(item.servings);
            const servings = Number.isFinite(countSrv) && countSrv > 0 ? countSrv : 1;
            const kcal = Math.round((item.calories ?? 0) * servings);
            return (
              <div
                key={item.name}
                className="flex items-center gap-2 bg-green-50/60 border border-green-100 rounded-xl px-2 py-1.5"
              >
                <FoodThumb name={item.name} size="sm" className="flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-800 break-words leading-snug">
                    {item.name}
                  </p>
                  <p className="text-[11px] text-green-700 font-medium mt-0.5">{kcal} kcal</p>
                </div>
                <div
                  className="flex items-center flex-shrink-0 h-7 rounded-lg border border-green-200 bg-white overflow-hidden"
                  role="group"
                  aria-label={`Quantity for ${item.name}`}
                >
                  <button
                    type="button"
                    aria-label={`Decrease ${item.name}`}
                    className="w-6 h-7 flex items-center justify-center text-green-700 active:bg-green-50"
                    onClick={() => {
                      const next = Math.max(QTY_MIN, snapHalfServing(servings - QTY_STEP));
                      onQuantityChange?.(item.name, String(next));
                    }}
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="min-w-[1.5rem] px-0.5 text-center text-[11px] font-bold text-gray-800 tabular-nums leading-none">
                    {formatQtyDisplay(servings)}
                  </span>
                  <button
                    type="button"
                    aria-label={`Increase ${item.name}`}
                    className="w-6 h-7 flex items-center justify-center text-green-700 active:bg-green-50"
                    onClick={() => {
                      onQuantityChange?.(
                        item.name,
                        String(snapHalfServing(servings + QTY_STEP)),
                      );
                    }}
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => onRemove?.(item)}
                  className="flex-shrink-0 p-0.5 text-gray-300 hover:text-red-400"
                  aria-label={`Remove ${item.name}`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}

          {count > 0 && (
            <div className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2.5 mt-1">
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Nutrition
              </p>
              <div className="grid grid-cols-4 gap-2 text-center">
                <MacroChip label="kcal" value={totalKcal} />
                <MacroChip label="P" value={`${protein}g`} />
                <MacroChip label="C" value={`${carbs}g`} />
                <MacroChip label="F" value={`${fat}g`} />
              </div>
            </div>
          )}
        </div>

        <div className="flex-shrink-0 px-4 pb-3 pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={onSave}
            disabled={count === 0}
            className="w-full px-3 py-2.5 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 active:bg-green-800 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <span>{saveMealLabel(count)}</span>
            <span className="text-[11px] font-medium text-green-100">· {totalKcal} kcal</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function MacroChip({ label, value }) {
  return (
    <div className="rounded-lg bg-white border border-gray-100 py-1.5">
      <p className="text-[10px] text-gray-400 font-medium">{label}</p>
      <p className="text-xs font-bold text-gray-800">{value}</p>
    </div>
  );
}
