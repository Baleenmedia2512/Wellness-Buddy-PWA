/**
 * FoodDetailModal.jsx — standalone read-only food detail view with delete option.
 *
 * Used by the unified Diary page (ADR-0003) to open a food entry's card
 * directly from a diary row. Unlike `MealAnalysisModal` (which needs the
 * NutritionDashboard edit orchestration), this is a pure presentational
 * modal driven entirely by the diary `payload` projection:
 *   { id, imageBase64, imagePath, analysisData, totals, ... }
 *
 * View-only: image + macro totals + per-item breakdown + delete action.
 * Editing individual food items still happens in the nutrition surface;
 * this satisfies the "card should open with delete option" requirement
 * for the Diary feed (matching the original dashboard tab cards).
 */
import React from 'react';
import { X, Flame, Trash2 } from 'lucide-react';

function macro(n) {
  const v = Number(n);
  return Number.isFinite(v) ? Math.round(v * 10) / 10 : 0;
}

function extractItems(analysisData) {
  if (!analysisData) return [];
  let parsed = analysisData;
  if (typeof analysisData === 'string') {
    try { parsed = JSON.parse(analysisData); } catch { return []; }
  }
  const foods = parsed?.foods || parsed?.detailedItems || [];
  if (!Array.isArray(foods)) return [];
  return foods.map((f) => ({
    name: f.name || f.foodName || 'Item',
    calories: macro(f.calories ?? f.nutrition?.calories ?? 0),
  }));
}

const FoodDetailModal = ({ payload, capturedAt, onClose, onDelete }) => {
  if (!payload) return null;

  const totals = payload.totals || {};
  const items = extractItems(payload.analysisData);
  const src =
    payload.imageBase64 && payload.imageBase64.trim() !== ''
      ? payload.imageBase64.startsWith('data:image')
        ? payload.imageBase64
        : `data:image/jpeg;base64,${payload.imageBase64}`
      : payload.imagePath || null;

  const time = capturedAt
    ? new Date(capturedAt).toLocaleString('en-US', {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
      })
    : '';

  const handleDelete = () => {
    if (onDelete && window.confirm('Delete this food entry? This action cannot be undone.')) {
      onDelete();
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        style={{ animation: 'slideUp 0.3s ease-out' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative">
          {src ? (
            <img src={src} alt="Meal" className="w-full h-48 object-cover" />
          ) : (
            <div className="w-full h-32 bg-emerald-50 flex items-center justify-center text-5xl">🍽️</div>
          )}
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-3 right-3 bg-white/90 rounded-full p-1.5 shadow"
          >
            <X className="w-5 h-5 text-gray-700" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Food</h3>
            {time ? <p className="text-xs text-gray-500">{time}</p> : null}
          </div>

          <div className="bg-orange-50 rounded-2xl p-4 border border-orange-100 flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm font-semibold text-orange-800">
              <Flame className="w-4 h-4" /> Calories
            </span>
            <span className="text-xl font-bold text-orange-700">
              {macro(totals.calories)} <span className="text-sm font-medium">kcal</span>
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              ['Protein', totals.protein, 'g'],
              ['Carbs', totals.carbs, 'g'],
              ['Fat', totals.fat, 'g'],
              ['Fiber', totals.fiber, 'g'],
            ].map(([label, val, unit]) => (
              <div key={label} className="bg-gray-50 rounded-xl py-2.5 border border-gray-100">
                <p className="text-sm font-bold text-gray-900">{macro(val)}{unit}</p>
                <p className="text-[11px] text-gray-500">{label}</p>
              </div>
            ))}
          </div>

          {items.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Items</h4>
              <ul className="space-y-1.5">
                {items.map((it, i) => (
                  <li
                    key={`${it.name}-${i}`}
                    className="flex justify-between items-center bg-white border border-gray-100 rounded-lg px-3 py-2"
                  >
                    <span className="text-sm text-gray-800 truncate pr-2">{it.name}</span>
                    <span className="text-sm font-medium text-gray-600 shrink-0">{it.calories} kcal</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Delete button — matches original dashboard card behavior */}
        {onDelete && (
          <div className="p-4 border-t border-gray-100">
            <button
              onClick={handleDelete}
              className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors"
            >
              <Trash2 className="w-5 h-5" />
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FoodDetailModal;
