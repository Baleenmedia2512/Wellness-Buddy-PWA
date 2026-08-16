/**
 * Read-only nutrition facts for a single food item in a meal.
 * Portaled to document.body so the title + close button are never clipped
 * by MealAnalysisModal / FoodDetailModal (overflow + transform containing blocks).
 */
import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { buildFoodItemNutritionFacts, FACT_SECTIONS } from '../domain/foodItemNutritionFacts';

const GI_TONE = {
  low: { text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  medium: { text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  high: { text: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200' },
};

function FactRow({ row }) {
  const isCalories = row.key === 'calories';
  const isNestedCarb = row.key === 'available_carbohydrate';
  return (
    <li
      className={`flex items-baseline justify-between py-2.5 ${isCalories ? 'pt-1' : ''}`}
    >
      <span className={`text-sm ${isCalories ? 'font-semibold text-gray-900' : isNestedCarb ? 'text-gray-500 pl-3' : 'text-gray-700'}`}>
        {row.label}
      </span>
      <span className={`tabular-nums ${isCalories ? 'text-lg font-extrabold text-orange-600' : 'text-sm font-semibold text-gray-900'}`}>
        {row.value}
        {row.unit ? (
          <span className="ml-1 text-xs font-medium text-gray-400">{row.unit}</span>
        ) : null}
      </span>
    </li>
  );
}

function FoodItemNutritionModal({ item, onClose }) {
  const facts = useMemo(() => buildFoodItemNutritionFacts(item), [item]);
  if (!item || typeof document === 'undefined') return null;

  const giRow = facts.rows.find((row) => row.key === 'glycemic_index');
  const otherRows = facts.rows.filter((row) => row.key !== 'glycemic_index');
  const giTone = facts.giZone ? GI_TONE[facts.giZone.tone] : null;
  const sections = FACT_SECTIONS.map((section) => ({
    ...section,
    rows: otherRows.filter((row) => row.section === section.id),
  })).filter((section) => section.rows.length > 0);

  return createPortal(
    <>
      <div
        className="fixed inset-0 bg-black/40 z-[80]"
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
        className="fixed bottom-0 left-0 right-0 z-[81] bg-white rounded-t-3xl shadow-2xl max-h-[88vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: 'slideUp 0.3s ease-out' }}
      >
        <div className="flex-shrink-0 flex items-start justify-between gap-3 px-4 py-3 border-b border-gray-200 bg-white">
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

        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
          {otherRows.length === 0 && !giRow ? (
            <p className="text-sm text-gray-500 py-8 text-center">
              No nutrition values stored for this item.
            </p>
          ) : (
            sections.map((section) => (
              <div key={section.id} className={section.id === 'macros' ? '' : 'mt-4'}>
                {section.label ? (
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 pb-1 border-b border-gray-100">
                    {section.label}
                  </p>
                ) : null}
                <ul className="divide-y divide-gray-100">
                  {section.rows.map((row) => (
                    <FactRow key={row.key} row={row} />
                  ))}
                </ul>
              </div>
            ))
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
    </>,
    document.body,
  );
}

export default FoodItemNutritionModal;
