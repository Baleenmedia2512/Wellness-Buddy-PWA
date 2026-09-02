import React from 'react';
import { Beef, Wheat, Droplet, Leaf } from 'lucide-react';
import TouchFeedbackButton from '../../../../shared/components/TouchFeedbackButton';
import EditableFoodItem from '../EditableFoodItem';
import MealAddItemForm from '../MealAddItemForm';
import StatusOverlay from './StatusOverlay';
import { parseAnalysisData, recalculateTotals } from '../../services/nutritionDashboard/analysisHelpers';
import { computeMealGlycemicIndex } from '../../domain/mealGlycemicIndex';
import { formatBusinessTime, resolveBusinessTimezone } from '../../../../shared/utils/datetimeUtils';
import {
  DIARY_FOOD_ACTIVITY,
  resolveFoodActivityType,
  extractVolumeMl,
  extractScoops,
} from '../../../diary/domain/activityType';
import { formatWaterVolume } from '../../../diary/domain/formatVolume';
import { resolveMealImageSrc } from '../../services/nutritionDashboard/mealImageSrc';
import { buildMealMicronutrientFallback } from '../../domain/foodItemNutritionFacts';

function uniqueFoodNames(items) {
  if (!Array.isArray(items) || items.length === 0) return [];
  const seen = new Set();
  const names = [];
  for (const item of items) {
    const name = String(item?.name || item?.foodName || '').trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names;
}

function longestNameList(...lists) {
  let best = [];
  for (const list of lists) {
    if (Array.isArray(list) && list.length > best.length) best = list;
  }
  return best;
}

function mealHasDisplayItems(localDetailedItems, foodData) {
  if (localDetailedItems?.length > 0) return true;
  return Array.isArray(foodData?.detailedItems) && foodData.detailedItems.length > 0;
}

const GIPill = ({ value }) => {
  if (value == null) return null;
  const label = value <= 55 ? 'Low GI' : value <= 69 ? 'Mid GI' : 'High GI';
  const color = value <= 55 ? 'bg-green-500/80' : value <= 69 ? 'bg-amber-500/80' : 'bg-red-500/80';
  return (
    <div className={`flex items-center ${color} backdrop-blur-sm rounded-full px-3 py-1.5 shadow-sm border border-white/10`}>
      <span className="text-xs font-medium text-white">{Math.round(value)} {label}</span>
    </div>
  );
};

const MacroPill = ({ icon: Icon, value }) => (
  <div className="flex items-center bg-white/15 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-sm border border-white/10">
    <Icon className="w-4 h-4 text-white mr-1.5" />
    <span className="text-xs font-medium text-white">{Math.round(value)}g</span>
  </div>
);

const NutritionAnalysisPanel = ({
  selectedMeal,
  mealDetailStatus = 'ready',
  mealDetailError = null,
  onRetryMealDetail,
  isClosingModal,
  isEditing,
  isSaving,
  saveStatus,
  setSaveStatus,
  deletingId,
  localDetailedItems,
  localNutrition,
  resetKey,
  itemRefs,
  editingStates,
  handleEditingChange,
  handleFoodUpdate,
  handleDeleteFoodItem,
  handleRestoreFoodItem,
  handleCloseModal,
  handleDeleteMeal,
  user,
  apiBaseUrl,
  timezoneIana: timezoneIanaProp,
  persistMealItems,
  setLocalDetailedItems,
  setLocalNutrition,
}) => {
  const editingIndex = (() => {
    const activeKey = Object.keys(editingStates || {}).find((key) => editingStates[key]);
    return activeKey != null ? parseInt(activeKey, 10) : null;
  })();

  if (!selectedMeal) return null;

  const isLoadingDetails = mealDetailStatus === 'loading';
  const isDetailError = mealDetailStatus === 'error';
  const foodData = parseAnalysisData(selectedMeal.AnalysisData, 'text-white');
  const itemNames = longestNameList(
    uniqueFoodNames(selectedMeal.listSummary?.items),
    uniqueFoodNames(localDetailedItems),
    uniqueFoodNames(foodData.detailedItems),
  );
  const fallbackTitle = selectedMeal.listSummary?.name || null;
  const displayTitle = itemNames.length > 0
    ? itemNames.join(', ')
    : ((isLoadingDetails || isDetailError) && !mealHasDisplayItems(localDetailedItems, foodData)
      ? (fallbackTitle || (isLoadingDetails ? 'Loading food details...' : foodData.name))
      : foodData.name);
  // Prefer explicit owner TZ (diary API / parent). Do not fall back to IST when
  // the logged-in `user` object is missing timezone — that caused "Logged at"
  // to show Kolkata time for Qatar/US/UK members.
  const timezoneIana = timezoneIanaProp || resolveBusinessTimezone(user);
  const mealTime = formatBusinessTime(
    selectedMeal.CreatedAt,
    timezoneIana,
    { hour: '2-digit', minute: '2-digit' },
  );
  const calories = localNutrition.calories || foodData.nutrition.calories || selectedMeal.TotalCalories || 0;
  const protein = localNutrition.protein || foodData.nutrition.protein || selectedMeal.TotalProtein || 0;
  const carbs = localNutrition.carbs || foodData.nutrition.carbs || selectedMeal.TotalCarbs || 0;
  const fat = localNutrition.fat || foodData.nutrition.fat || selectedMeal.TotalFat || 0;
  const fiber = localNutrition.fiber || foodData.nutrition.fiber || selectedMeal.TotalFiber || 0;
  // Prefer live weighted GI from food items (heals legacy summed totals like 287)
  const glycemicIndex = computeMealGlycemicIndex(localDetailedItems)
    ?? (localNutrition.glycemic_index != null
      ? localNutrition.glycemic_index
      : (localNutrition.glycemicIndex != null
        ? localNutrition.glycemicIndex
        : (selectedMeal.GlycemicIndex ?? foodData.nutrition.glycemic_index ?? null)));

  const displayItemCount = Math.max(
    localDetailedItems?.length || 0,
    foodData.detailedItems?.length || 0,
    selectedMeal.listSummary?.items?.length || 0,
  );
  const mealMicronutrientFallback = displayItemCount === 1
    ? buildMealMicronutrientFallback({ ...selectedMeal, nutrition: foodData.nutrition })
    : null;

  const activityType = resolveFoodActivityType({
    processedBy: selectedMeal.ProcessedBy,
    analysisData: selectedMeal.AnalysisData,
    foodData: {
      name: foodData.name,
      detailedItems: localDetailedItems?.length ? localDetailedItems : foodData.detailedItems,
    },
  });
  const isWater = activityType === DIARY_FOOD_ACTIVITY.WATER;
  const isAfresh = activityType === DIARY_FOOD_ACTIVITY.AFRESH;
  const hideMacroHeader = isWater || isAfresh;
  const volumeMl = extractVolumeMl(
    { detailedItems: localDetailedItems?.length ? localDetailedItems : foodData.detailedItems },
    selectedMeal.AnalysisData,
  );
  const scoops = extractScoops(
    { detailedItems: localDetailedItems?.length ? localDetailedItems : foodData.detailedItems },
    selectedMeal.AnalysisData,
  );
  const headerPrimary = isWater
    ? (volumeMl != null ? formatWaterVolume(volumeMl) : '—')
    : isAfresh
      ? `${scoops ?? 1} ${(scoops ?? 1) === 1 ? 'scoop' : 'scoops'}`
      : null;

  const handleAddItem = async (newItem) => {
    const newItems = [...(localDetailedItems || []), newItem];
    const newTotals = recalculateTotals(newItems);
    setLocalDetailedItems(newItems);
    setLocalNutrition(newTotals);
    await persistMealItems(newItems, newTotals);
  };
  const imgSrc = resolveMealImageSrc(selectedMeal, {
    userId: user?.id || user?.userId || user?.UserId,
    apiBaseUrl,
  });

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end justify-center p-4"
      onClick={isSaving || saveStatus ? undefined : handleCloseModal}
    >
      <div
        className={`bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden transition-all duration-500 ease-in-out ${isClosingModal ? 'animate-slideDown' : 'animate-slideUp'} ${isEditing ? 'max-h-[90vh]' : 'max-h-[80vh]'} relative`}
        onClick={(e) => e.stopPropagation()}
      >
        {saveStatus && <StatusOverlay status={saveStatus} onRetry={() => setSaveStatus(null)} />}

        <div className="relative flex flex-col min-h-0" style={{ maxHeight: isEditing ? '90vh' : '80vh' }}>
          <div className="relative">
            {imgSrc ? (
              <img src={imgSrc} alt="Meal"
                className={`w-full object-cover transition-all duration-500 ease-in-out ${isEditing ? 'h-48' : 'h-72'}`}
                onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=880&q=80'; }} />
            ) : (
              <div className={`w-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center ${isEditing ? 'h-48' : 'h-72'}`} />
            )}

            <div className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent transition-all ${isEditing ? 'p-3 space-y-1' : 'p-5 space-y-3'}`}>
              <div className="flex justify-between items-start">
                <div>
                  <h2 className={`font-bold text-white leading-tight ${isEditing ? 'text-lg' : 'text-xl'}`}>{displayTitle}</h2>
                  <p className={`text-white/70 mt-0.5 ${isEditing ? 'text-[10px]' : 'text-xs'}`}>Logged at {mealTime}</p>
                </div>
                <div className="text-right">
                  {headerPrimary ? (
                    <span className={`font-bold text-white ${isEditing ? 'text-2xl' : 'text-3xl'}`}>{headerPrimary}</span>
                  ) : (
                    <>
                      <span className={`font-bold text-white ${isEditing ? 'text-2xl' : 'text-3xl'}`}>{Math.round(calories)}</span>
                      <span className={`text-white/70 ml-1 ${isEditing ? 'text-[10px]' : 'text-xs'}`}>kcal</span>
                    </>
                  )}
                </div>
              </div>
              {!hideMacroHeader && (
                <div className={`flex flex-wrap gap-2 pt-1 overflow-hidden transition-all ${isEditing ? 'max-h-0 opacity-0' : 'max-h-20 opacity-100'}`}>
                  <MacroPill icon={Beef} value={protein} />
                  <MacroPill icon={Wheat} value={carbs} />
                  <MacroPill icon={Droplet} value={fat} />
                  <MacroPill icon={Leaf} value={fiber} />
                  <GIPill value={glycemicIndex} />
                </div>
              )}
            </div>

            <button onClick={handleCloseModal} disabled={isSaving || saveStatus}
              className={`absolute top-4 right-4 w-9 h-9 bg-black/40 backdrop-blur-sm text-white rounded-full flex items-center justify-center border border-white/20 ${isSaving || saveStatus ? 'opacity-50 cursor-not-allowed' : 'hover:bg-black/60'}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="p-4 overflow-y-auto flex-1 min-h-0" style={{ maxHeight: isEditing ? '60vh' : '40vh' }}>
            {isLoadingDetails && !mealHasDisplayItems(localDetailedItems, foodData) ? (
              <div className="flex flex-col items-center justify-center py-10 text-gray-500" data-testid="meal-detail-loading">
                <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-sm font-medium">Loading food details...</p>
              </div>
            ) : isDetailError && !mealHasDisplayItems(localDetailedItems, foodData) ? (
              <div className="flex flex-col items-center justify-center py-10 text-center" data-testid="meal-detail-error">
                <p className="text-sm font-medium text-gray-700 mb-3">
                  {mealDetailError || 'Unable to load food details.'}
                </p>
                <TouchFeedbackButton
                  className="rounded-xl bg-emerald-600 text-white text-sm font-semibold px-4 py-2.5 shadow-sm hover:bg-emerald-700 active:scale-95"
                  onClick={() => onRetryMealDetail?.()}
                >
                  Retry
                </TouchFeedbackButton>
              </div>
            ) : localDetailedItems?.length > 0 ? (
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-900 text-sm">
                  {isWater ? 'Water' : isAfresh ? 'Afresh' : 'Food Items'}
                </h3>
                <div className="space-y-2">
                  {[...localDetailedItems]
                    .map((item, originalIndex) => ({ item, originalIndex, calories: item?.nutrition?.calories || item?.calories || 0 }))
                    .sort((a, b) => b.calories - a.calories)
                    .map(({ item, originalIndex }) => (
                      <div key={`${originalIndex}-${resetKey}`}>
                        <EditableFoodItem
                          ref={(el) => (itemRefs.current[originalIndex] = el)}
                          foodItem={item} index={originalIndex}
                          onUpdate={handleFoodUpdate} onDelete={handleDeleteFoodItem}
                          onRestore={handleRestoreFoodItem} onEditingChange={handleEditingChange}
                          disabled={isEditing && !editingStates[originalIndex]} hideButtons={false} user={user}
                          mealFallback={mealMicronutrientFallback} />
                      </div>
                    ))}
                </div>
              </div>
            ) : isLoadingDetails ? (
              <div className="flex flex-col items-center justify-center py-6 text-gray-500" data-testid="meal-detail-loading-inline">
                <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-2" />
                <p className="text-sm">Loading food details...</p>
              </div>
            ) : isDetailError ? (
              <div className="text-center py-6" data-testid="meal-detail-error-inline">
                <p className="text-sm text-gray-600 mb-3">{mealDetailError || 'Unable to load food details.'}</p>
                <TouchFeedbackButton
                  className="rounded-xl bg-emerald-600 text-white text-sm font-semibold px-4 py-2 shadow-sm"
                  onClick={() => onRetryMealDetail?.()}
                >
                  Retry
                </TouchFeedbackButton>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No items yet. Tap Add Item below.</p>
            )}
          </div>

          {!isEditing && (
            isWater || isAfresh ? (
              <div className="p-4 border-t border-gray-100 shrink-0 bg-white">
                <TouchFeedbackButton
                  disabled={deletingId === selectedMeal?.ID}
                  className={`w-full flex items-center justify-center gap-2 rounded-xl text-white text-sm font-semibold px-4 py-3 shadow-sm ${deletingId === selectedMeal?.ID ? 'bg-red-400 cursor-not-allowed' : 'bg-red-500 hover:bg-red-600 active:scale-95'}`}
                  onClick={() => handleDeleteMeal(selectedMeal)}
                >
                  {deletingId === selectedMeal?.ID ? 'Deleting…' : 'Delete'}
                </TouchFeedbackButton>
              </div>
            ) : (
              <MealAddItemForm
                layout="footer"
                user={user}
                disabled={isSaving || editingIndex !== null}
                isSaving={isSaving}
                onAdd={handleAddItem}
                footerExtra={
                  <TouchFeedbackButton
                    disabled={deletingId === selectedMeal?.ID}
                    className={`flex-1 flex items-center justify-center gap-2 rounded-xl text-white text-sm font-semibold px-4 py-3 shadow-sm ${deletingId === selectedMeal?.ID ? 'bg-red-400 cursor-not-allowed' : 'bg-red-500 hover:bg-red-600 active:scale-95'}`}
                    onClick={() => handleDeleteMeal(selectedMeal)}
                  >
                    {deletingId === selectedMeal?.ID ? 'Deleting…' : 'Delete'}
                  </TouchFeedbackButton>
                }
              />
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default NutritionAnalysisPanel;
