/**
 * ManualFoodAiAnalysisModal — AI food review on Manual Log.
 * Success UI matches Diary/Nutrition "Food Items" cards (EditableFoodItem).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import EditableFoodItem from '../../features/nutrition/components/EditableFoodItem';
import { transformDbItemToEditable } from '../../features/nutrition/services/nutritionDashboard/foodItemTransform';
import { recalculateTotals } from '../../features/nutrition/services/nutritionDashboard/analysisHelpers';
import { computeMealGlycemicIndex } from '../../features/nutrition/domain/mealGlycemicIndex';

function previewUrl(imageBase64) {
  if (!imageBase64) return null;
  return imageBase64.startsWith('data:')
    ? imageBase64
    : `data:image/jpeg;base64,${imageBase64}`;
}

function foodsToEditableItems(analysisResult) {
  const foods = Array.isArray(analysisResult?.foods) ? analysisResult.foods : [];
  return foods
    .filter(Boolean)
    .map((f) => transformDbItemToEditable({
      name: f.name,
      nutrition: f.nutrition || {},
      weight_g: f.weight_g,
      volume_ml: f.volume_ml,
      portion: f.portion || f.portionDescription,
      unit: f.unit,
      isLiquid: f.isLiquid,
    }, true));
}

function editableItemsToAnalysis(items, previous = null) {
  const foods = (items || []).map((item) => ({
    name: item.name,
    portion: item.portionDescription || item.portion || item.serving?.description,
    weight_g: item.weight_g ?? item.grams ?? item.serving?.grams,
    volume_ml: item.volume_ml,
    unit: item.unit || item.serving?.unit,
    isLiquid: item.isLiquid ?? item.serving?.isLiquid,
    nutrition: item.nutrition || {},
  }));
  const totals = recalculateTotals(items) || {};
  const prevTotal = previous?.total || {};
  return {
    foods,
    total: {
      ...prevTotal,
      ...totals,
      calories: totals.calories ?? 0,
      protein: totals.protein ?? 0,
      carbs: totals.carbs ?? 0,
      fat: totals.fat ?? 0,
      fiber: totals.fiber ?? 0,
      glycemic_index: computeMealGlycemicIndex(foods) ?? prevTotal.glycemic_index ?? null,
    },
    confidence: previous?.confidence || 'medium',
  };
}

/**
 * @param {{
 *   open: boolean,
 *   stage: 'analysing'|'success'|'failed'|'unidentified',
 *   imageBase64: string|null,
 *   analysisResult: object|null,
 *   errorMessage?: string|null,
 *   saving?: boolean,
 *   user?: object|null,
 *   onCancel: () => void,
 *   onSave: (analysisResult: object) => void,
 *   onRetry?: () => void,
 *   onManualLog?: () => void,
 * }} props
 */
export default function ManualFoodAiAnalysisModal({
  open,
  stage,
  imageBase64,
  analysisResult = null,
  errorMessage = null,
  saving = false,
  user = null,
  onCancel,
  onSave,
  onRetry,
  onManualLog,
}) {
  const saveLockRef = useRef(false);
  const src = useMemo(() => previewUrl(imageBase64), [imageBase64]);
  const [localItems, setLocalItems] = useState([]);
  const [editingStates, setEditingStates] = useState({});
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    if (stage !== 'success') saveLockRef.current = false;
    if (!saving) saveLockRef.current = false;
  }, [stage, saving]);

  useEffect(() => {
    if (!open || stage !== 'success' || !analysisResult) return;
    setLocalItems(foodsToEditableItems(analysisResult));
    setEditingStates({});
    setResetKey((k) => k + 1);
  }, [open, stage, analysisResult]);

  const isEditing = Object.values(editingStates).some(Boolean);

  const handleUpdate = useCallback((index, updatedItem) => {
    setLocalItems((prev) => {
      const next = [...prev];
      next[index] = updatedItem;
      return next;
    });
  }, []);

  const handleDelete = useCallback((index) => {
    setLocalItems((prev) => prev.filter((_, i) => i !== index));
    setEditingStates({});
  }, []);

  const handleRestore = useCallback((index, item) => {
    setLocalItems((prev) => {
      const next = [...prev];
      next.splice(index, 0, item);
      return next;
    });
  }, []);

  const handleEditingChange = useCallback((index, editing) => {
    setEditingStates((prev) => ({ ...prev, [index]: editing }));
  }, []);

  if (!open) return null;

  const handleSave = () => {
    if (saving || saveLockRef.current || localItems.length === 0) return;
    saveLockRef.current = true;
    onSave?.(editableItemsToAnalysis(localItems, analysisResult));
  };

  const sorted = [...localItems]
    .map((item, originalIndex) => ({
      item,
      originalIndex,
      calories: item?.nutrition?.calories || item?.calories || 0,
    }))
    .sort((a, b) => b.calories - a.calories);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="manual-ai-food-title"
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/80 sm:items-center"
      onClick={(e) => {
        if (stage === 'analysing') return;
        if (e.target === e.currentTarget) onCancel?.();
      }}
    >
      <div
        className="flex w-full max-w-md max-h-[92vh] flex-col overflow-hidden rounded-t-3xl bg-white shadow-xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h2 id="manual-ai-food-title" className="text-base font-semibold text-gray-900">
            {stage === 'analysing' && 'Analysing your food…'}
            {stage === 'success' && 'AI food analysis'}
            {stage === 'failed' && 'Analysis failed'}
            {stage === 'unidentified' && 'Food not identified'}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            disabled={saving || (stage === 'success' && isEditing)}
            className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 disabled:opacity-40"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {src && (
            <img
              src={src}
              alt="Selected food"
              className="w-full max-h-48 rounded-xl object-cover bg-gray-100"
            />
          )}

          {stage === 'analysing' && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <Loader2 className="h-10 w-10 animate-spin text-emerald-600" aria-hidden />
              <p className="text-sm font-medium text-gray-800">Analysing your food…</p>
              <p className="text-xs text-gray-500">This may take a moment. Please keep this open.</p>
            </div>
          )}

          {stage === 'success' && (
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900 text-sm">Food Items</h3>
              {sorted.length > 0 ? (
                <div className="space-y-2">
                  {sorted.map(({ item, originalIndex }) => (
                    <div key={`${originalIndex}-${resetKey}`}>
                      <EditableFoodItem
                        foodItem={item}
                        index={originalIndex}
                        onUpdate={handleUpdate}
                        onDelete={handleDelete}
                        onRestore={handleRestore}
                        onEditingChange={handleEditingChange}
                        disabled={isEditing && !editingStates[originalIndex]}
                        hideButtons={false}
                        user={user}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No food items left. Use Edit manually or Retry.</p>
              )}
            </div>
          )}

          {stage === 'failed' && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 space-y-1">
              <p className="font-medium">Unable to analyse this food image.</p>
              <p>{errorMessage || 'Please try again or log the food manually.'}</p>
            </div>
          )}

          {stage === 'unidentified' && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 space-y-1">
              <p className="font-medium">We couldn&apos;t identify the food in this image.</p>
              <p>Please try another image or log the food manually.</p>
            </div>
          )}
        </div>

        <div className="border-t border-gray-100 px-4 py-3 flex gap-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {stage === 'analysing' && (
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          )}

          {stage === 'success' && (
            <>
              <button
                type="button"
                onClick={onManualLog}
                disabled={saving || isEditing}
                className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Edit manually
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || isEditing || localItems.length === 0}
                className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </>
          )}

          {(stage === 'failed' || stage === 'unidentified') && (
            <>
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="flex-1 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
                >
                  Retry
                </button>
              )}
              <button
                type="button"
                onClick={onManualLog}
                className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white"
              >
                Log manually
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
