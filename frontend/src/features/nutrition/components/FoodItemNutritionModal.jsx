/**
 * Read-only nutrition facts for a single food item in a meal.
 * Stacks above MealAnalysisModal / FoodDetailModal (z-50).
 */
import React, { useMemo } from 'react';
import { X } from 'lucide-react';
import { buildFoodItemNutritionFacts } from '../domain/foodItemNutritionFacts';

const GI_TONE = {
  low: { text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  medium: { text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  high: { text: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200' },
};

function FoodItemNutritionModal({ item, onClose }) {
  const facts = useMemo(() => buildFoodItemNutritionFacts(item), [item]);
  if (!item) return null;

  const giRow = facts.rows.find((row) => row.key === 'glycemic_index');
  const otherRows = facts.rows.filter((row) => row.key !== 'glycemic_index');
  const giTone = facts.giZone ? GI_TONE[facts.giZone.tone] : null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 z-[70]"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        style={{ animation: 'fadeIn 0.2s ease-out' }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="food-item-nutrition-title"
        className="fixed bottom-0 left-0 right-0 z-[71] bg-white rounded-t-3xl shadow-2xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: 'slideUp 0.3s ease-out' }}
      >
        <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-gray-200">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              Nutrition facts
            </p>
            <h2
              id="food-item-nutrition-title"
              className="text-lg font-bold text-gray-900 leading-snug"
            >
              {facts.name}
            </h2>
            {facts.portion ? (
              <p className="text-xs text-gray-500 mt-0.5">{facts.portion}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors shrink-0"
            aria-label="Close nutrition facts"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {otherRows.length === 0 && !giRow ? (
            <p className="text-sm text-gray-500 py-8 text-center">
              No nutrition values stored for this item.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {otherRows.map((row) => (
                <li
                  key={row.key}
                  className={`flex items-baseline justify-between py-2.5 ${
                    row.key === 'calories' ? 'pt-1' : ''
                  }`}
                >
                  <span className={`text-sm ${row.key === 'calories' ? 'font-semibold text-gray-900' : row.key === 'available_carbohydrate' ? 'text-gray-500 pl-3' : 'text-gray-700'}`}>
                    {row.label}
                  </span>
                  <span className={`tabular-nums ${row.key === 'calories' ? 'text-lg font-extrabold text-orange-600' : 'text-sm font-semibold text-gray-900'}`}>
                    {row.value}
                    {row.unit ? (
                      <span className="ml-1 text-xs font-medium text-gray-400">{row.unit}</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {giRow && (
            <div className={`mt-3 flex items-center justify-between rounded-2xl border px-4 py-2.5 ${giTone?.bg || 'bg-gray-50'} ${giTone?.border || 'border-gray-200'}`}>
              <span className={`text-sm font-semibold ${giTone?.text || 'text-gray-700'}`}>
                {giRow.label}
              </span>
              <div className="flex items-center gap-2">
                <span className={`text-xl font-extrabold ${giTone?.text || 'text-gray-900'}`}>
                  {giRow.value}
                </span>
                {facts.giZone ? (
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/80 border ${giTone?.border} ${giTone?.text}`}>
                    {facts.giZone.label}
                  </span>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default FoodItemNutritionModal;
