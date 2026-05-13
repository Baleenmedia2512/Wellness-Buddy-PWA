import React from 'react';
import { UtensilsCrossed } from 'lucide-react';
import MealCard from './MealCard';
import UndoRow from './UndoRow';
import {
  parseAnalysisData,
  istToLocalDate,
  getMealCategory,
} from '../../services/nutritionDashboard/analysisHelpers';
import {
  getMealCategoryInfo,
  formatTimeRangeAMPM,
  MEAL_CATEGORY_ORDER,
} from '../../services/nutritionDashboard/mealCategoryHelpers';
import { UNDO_SECONDS } from '../../hooks/useNutritionUndo';

const NutritionMealList = ({
  analyses,
  displayedMeals,
  hasMoreMeals,
  loadingMore,
  sentinelRef,
  undoState,
  setSelectedMeal,
  handleOptimisticDelete,
  isIOS,
  user,
  setAnalyses,
  setUndoState,
  applyDailyDelta,
}) => {
  const hasUndoPlaceholders = analyses.some((a) => a.isUndoPlaceholder);
  const hasRealMeals = analyses.some((a) => !a.isUndoPlaceholder);

  if (!hasRealMeals && !hasUndoPlaceholders) {
    return (
      <div className="text-center py-16 px-6 backdrop-blur-xl bg-white/30 rounded-2xl shadow-lg border border-white/40">
        {isIOS ? (
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center">
              <UtensilsCrossed className="w-9 h-9 text-green-400" />
            </div>
          </div>
        ) : (
          <div className="text-6xl mb-4">🥗</div>
        )}
        <h3 className="text-xl font-semibold text-gray-800 mb-2">No Meals Logged</h3>
        <p className="text-gray-600 max-w-xs mx-auto">
          Use the camera to snap a photo of your food and see your nutrition insights here.
        </p>
      </div>
    );
  }

  const groupedDisplayedMeals = displayedMeals.reduce((acc, analysis) => {
    const category = getMealCategory(analysis.CreatedAt);
    if (!acc[category]) acc[category] = [];
    acc[category].push(analysis);
    return acc;
  }, {});

  return (
    <>
      {MEAL_CATEGORY_ORDER.map((category) => {
        const meals = groupedDisplayedMeals[category] || [];
        if (meals.length === 0) return null;
        const info = getMealCategoryInfo(category);
        const categoryCalories = meals.reduce((sum, meal) => {
          if (meal.isUndoPlaceholder) return sum;
          const food = parseAnalysisData(meal.AnalysisData);
          return sum + (food.nutrition.calories || meal.TotalCalories || 0);
        }, 0);

        return (
          <div key={category}>
            <div className="flex items-center justify-between mb-3 px-2">
              <div>
                <h3 className="text-lg font-semibold text-gray-800">{info.name}</h3>
                <p className="text-sm text-gray-500">{formatTimeRangeAMPM(info.timeRange)}</p>
              </div>
              <div className="text-right">
                <p className="text-base font-semibold text-gray-800">{Math.round(categoryCalories)}</p>
                <p className="text-xs text-gray-500">kcal</p>
              </div>
            </div>

            <div className="space-y-3">
              {meals
                .slice()
                .sort((a, b) => istToLocalDate(a.CreatedAt) - istToLocalDate(b.CreatedAt))
                .map((meal, mealIndex) => {
                  if (meal.isUndoPlaceholder) {
                    const entry = undoState[meal.ID];
                    if (!entry) return null;
                    return (
                      <UndoRow
                        key={`${meal.ID}-${mealIndex}`}
                        pid={meal.ID}
                        originalMeal={entry.originalMeal}
                        expiresAt={entry.expiresAt}
                        ttlSeconds={entry.ttlSeconds ?? UNDO_SECONDS}
                        user={user}
                        setAnalyses={setAnalyses}
                        setUndoState={setUndoState}
                        applyDailyDelta={applyDailyDelta}
                      />
                    );
                  }
                  const foodData = parseAnalysisData(meal.AnalysisData);
                  const mealTime = istToLocalDate(meal.CreatedAt).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  const calories = foodData.nutrition.calories || meal.TotalCalories || 0;
                  return (
                    <MealCard
                      key={`${meal.ID}-${mealIndex}`}
                      meal={meal}
                      foodData={foodData}
                      mealTime={mealTime}
                      calories={calories}
                      onDelete={handleOptimisticDelete}
                      onClick={(m) => setSelectedMeal(m)}
                    />
                  );
                })}
            </div>
          </div>
        );
      })}

      {hasMoreMeals && (
        <div ref={sentinelRef} className="py-4 flex justify-center">
          {loadingMore && (
            <div className="flex items-center gap-2 text-emerald-600">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-emerald-300 border-t-emerald-600" />
              <span className="text-sm font-medium">Loading more meals...</span>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default NutritionMealList;
