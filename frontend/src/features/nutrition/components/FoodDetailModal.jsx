/**
 * FoodDetailModal.jsx — standalone read-only food detail view with delete option.
 *
 * Used by the unified Diary page (ADR-0003) to open a food entry's card
 * directly from a diary row. Unlike `MealAnalysisModal` (which needs the
 * NutritionDashboard edit orchestration), this is a pure presentational
 * modal driven entirely by the diary `payload` projection.
 *
 * Water / Afresh / shake display mirrors `diary/domain/*` (kept local to
 * avoid a nutrition ↔ diary circular import via the diary barrel).
 */
import React, { useRef, useState, useMemo } from 'react';
import { X, Flame, Trash2, Share2, Droplets, ChevronRight } from 'lucide-react';
import { captureAndShare } from '../../../shared/utils/shareUtils';
import { withMarathonWhatsAppNotice } from '../../marathon';
import { parseAnalysisData, getMealCategory } from '../services/nutritionDashboard/analysisHelpers';
import { buildDiaryShareSuffix } from '../../diary/domain/share/suffixes';
import FoodItemNutritionModal from './FoodItemNutritionModal';

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
    ...f,
    name: f.name || f.foodName || 'Item',
  }));
}

function parseRaw(analysisData) {
  if (!analysisData) return null;
  if (typeof analysisData === 'object') return analysisData;
  try { return JSON.parse(analysisData); } catch { return null; }
}

function resolveActivityType(payload, foodData) {
  const raw = parseRaw(payload?.analysisData);
  const by = String(payload?.processedBy || raw?.processedBy || '').toLowerCase();
  if (by === 'water_preset') return 'water';
  if (by === 'afresh_preset') return 'afresh';
  if (by === 'shake_calculator') return 'shake';
  const items = foodData?.detailedItems || raw?.foods || [];
  const name = String(items[0]?.name || foodData?.name || '').toLowerCase();
  if (name === 'water' || name === 'plain water' || name.startsWith('plain water')) return 'water';
  if (name.includes('afresh')) return 'afresh';
  if (name.includes('herbalife shake') || name.includes('protein shake')) return 'shake';
  return 'food';
}

function formatWaterVolume(ml) {
  const n = Number(ml);
  if (!Number.isFinite(n) || n <= 0) return '0 mL';
  if (n >= 1000) {
    const liters = n / 1000;
    const label = Number.isInteger(liters)
      ? String(liters)
      : String(Math.round(liters * 100) / 100).replace(/\.?0+$/, '');
    return `${label} L`;
  }
  return `${Math.round(n)} mL`;
}

function extractVolumeMl(foodData, analysisData) {
  const raw = parseRaw(analysisData);
  const items = foodData?.detailedItems || raw?.foods || [];
  let sum = 0;
  let found = false;
  for (const item of items) {
    const ml = Number(item?.volume_ml);
    if (Number.isFinite(ml) && ml > 0) {
      sum += ml;
      found = true;
    }
  }
  return found ? sum : null;
}

function extractScoops(foodData, analysisData) {
  const raw = parseRaw(analysisData);
  const items = foodData?.detailedItems || raw?.foods || [];
  for (const item of items) {
    const next = Number(item?.scoops);
    if (Number.isFinite(next) && next > 0) return next;
  }
  return null;
}

function extractShakeProducts(foodData, analysisData) {
  const raw = parseRaw(analysisData);
  const candidates = [
    foodData?.shakeProducts,
    raw?.shakeProducts,
    ...(foodData?.detailedItems || []).map((item) => item?.shakeProducts),
    ...(raw?.foods || []).map((item) => item?.shakeProducts),
  ];
  for (const products of candidates) {
    if (!products || typeof products !== 'object') continue;
    const formula1 = Number(products.formula1);
    const shakemate = Number(products.shakemate);
    const protein = Number(products.protein);
    if (![formula1, shakemate, protein].some((n) => Number.isFinite(n))) continue;
    return {
      formula1: Math.max(0, Math.round(formula1) || 0),
      shakemate: Math.max(0, Math.round(shakemate) || 0),
      protein: Math.max(0, Math.round(protein) || 0),
    };
  }
  return null;
}

const MEAL_LABELS = {
  breakfast: 'Breakfast',
  'morning-snack': 'Snack',
  lunch: 'Lunch',
  'evening-snack': 'Snack',
  dinner: 'Dinner',
  'late-night': 'Snack',
};

function buildShareText({
  activityType, foodName, calories, volumeMl, scoops, servings, shakeProducts, nutrition = {},
  glycemicIndex = null,
  itemNames = null,
}) {
  if (activityType === 'water') {
    return buildDiaryShareSuffix('water', { volumeMl, soFarToday: false });
  }
  if (activityType === 'afresh') {
    return buildDiaryShareSuffix('afresh', {
      scoops: scoops ?? 1,
      calories,
      soFarToday: false,
    });
  }
  if (activityType === 'shake') {
    return buildDiaryShareSuffix('shake', {
      shakeName: foodName || 'Protein Shake',
      servings: servings || 1,
      shakeProducts,
    });
  }
  return buildDiaryShareSuffix('food', {
    foodName,
    itemNames,
    calories,
    protein: nutrition.protein ?? 0,
    carbs: nutrition.carbs ?? 0,
    fat: nutrition.fat ?? 0,
    fiber: nutrition.fiber ?? 0,
    glycemicIndex: glycemicIndex ?? nutrition.glycemic_index ?? null,
  });
}

const FoodDetailModal = ({ payload, capturedAt, onClose, onDelete }) => {
  const cardRef = useRef(null);
  const [isSharing, setIsSharing] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  const foodData = useMemo(
    () => parseAnalysisData(payload?.analysisData),
    [payload?.analysisData],
  );
  const activityType = useMemo(
    () => resolveActivityType(payload, foodData),
    [payload, foodData],
  );
  const volumeMl = useMemo(
    () => extractVolumeMl(foodData, payload?.analysisData),
    [foodData, payload?.analysisData],
  );
  const scoops = useMemo(
    () => extractScoops(foodData, payload?.analysisData),
    [foodData, payload?.analysisData],
  );
  const shakeProducts = useMemo(
    () => extractShakeProducts(foodData, payload?.analysisData),
    [foodData, payload?.analysisData],
  );

  if (!payload) return null;

  const totals = payload.totals || {};
  const items = extractItems(payload.analysisData);
  const mealCategory = capturedAt ? getMealCategory(capturedAt) : null;
  const mealLabel = mealCategory ? (MEAL_LABELS[mealCategory] || 'Meal') : 'Meal';
  const foodName = foodData.name || (items[0]?.name) || 'Food';
  const isWater = activityType === 'water';
  const isAfresh = activityType === 'afresh';
  const shareText = buildShareText({
    activityType,
    foodName,
    calories: totals.calories ?? foodData?.nutrition?.calories ?? 0,
    volumeMl,
    scoops,
    servings: 1,
    shakeProducts,
    itemNames: items.map((item) => item.name).filter(Boolean),
    nutrition: {
      protein: totals.protein ?? foodData?.nutrition?.protein ?? 0,
      carbs: totals.carbs ?? foodData?.nutrition?.carbs ?? 0,
      fat: totals.fat ?? foodData?.nutrition?.fat ?? 0,
      fiber: totals.fiber ?? foodData?.nutrition?.fiber ?? 0,
    },
    glycemicIndex: totals.glycemicIndex ?? foodData?.nutrition?.glycemic_index ?? null,
  });
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

  const handleShare = async () => {
    if (isSharing || !cardRef.current) return;
    setIsSharing(true);
    try {
      await captureAndShare(cardRef.current, {
        title: foodName,
        text: withMarathonWhatsAppNotice(shareText),
        fileName: `wellness-${activityType}-${Date.now()}.png`,
      });
    } catch (err) {
      if (!err?.message?.toLowerCase().includes('cancel')) {
        console.error('Share failed:', err);
      }
    } finally {
      setIsSharing(false);
    }
  };

  const title = isWater
    ? 'Water'
    : isAfresh
      ? 'Afresh'
      : activityType === 'shake'
        ? 'Protein Shake'
        : 'Food';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        ref={cardRef}
        className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        style={{ animation: 'slideUp 0.3s ease-out' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative">
          {src ? (
            <img src={src} alt="Meal" className="w-full h-48 object-cover" />
          ) : (
            <div className="w-full h-32 bg-emerald-50 flex items-center justify-center text-5xl">
              {isWater ? '💧' : isAfresh ? '🥤' : '🍽️'}
            </div>
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
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            {time ? <p className="text-xs text-gray-500">{time}</p> : null}
          </div>

          {isWater ? (
            <div className="bg-sky-50 rounded-2xl p-4 border border-sky-100 flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-semibold text-sky-800">
                <Droplets className="w-4 h-4" /> Consumed
              </span>
              <span className="text-xl font-bold text-sky-700">
                {volumeMl != null ? formatWaterVolume(volumeMl) : '—'}
              </span>
            </div>
          ) : isAfresh ? (
            <div className="bg-orange-50 rounded-2xl p-4 border border-orange-100 flex items-center justify-between">
              <span className="text-sm font-semibold text-orange-800">Scoops</span>
              <span className="text-xl font-bold text-orange-700">{scoops ?? 1}</span>
            </div>
          ) : (
            <>
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
                      <li key={`${it.name}-${i}`}>
                        <button
                          type="button"
                          onClick={() => setSelectedItem(it)}
                          className="w-full flex justify-between items-center bg-white border border-gray-100 rounded-lg px-3 py-2 text-left hover:border-emerald-200 hover:bg-emerald-50/40 active:scale-[0.99] transition-colors"
                          aria-label={`View nutrition facts for ${it.name}`}
                        >
                          <span className="text-sm text-gray-800 truncate pr-2">{it.name}</span>
                          <span className="flex items-center gap-1 shrink-0">
                            <span className="text-sm font-medium text-gray-600">
                              {macro(it.calories ?? it.nutrition?.calories ?? 0)} kcal
                            </span>
                            <ChevronRight className="w-4 h-4 text-gray-300" aria-hidden="true" />
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>

        <div className="p-4 border-t border-gray-100 flex gap-3">
          <button
            onClick={handleShare}
            disabled={isSharing}
            className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors"
          >
            {isSharing ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Share2 className="w-5 h-5" />
            )}
            {isSharing ? 'Sharing…' : 'Share'}
          </button>
          {onDelete && (
            <button
              onClick={handleDelete}
              className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors"
            >
              <Trash2 className="w-5 h-5" />
              Delete
            </button>
          )}
        </div>
      </div>
      {selectedItem && (
        <FoodItemNutritionModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  );
};

export default FoodDetailModal;
