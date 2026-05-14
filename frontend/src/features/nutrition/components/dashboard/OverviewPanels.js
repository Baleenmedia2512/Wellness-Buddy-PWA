import React from 'react';
import NutritionSummaryCards from './NutritionSummaryCards';
import NutritionFilters from './NutritionFilters';

/**
 * Swipe-pair card containing the daily Summary panel and the calorie Trend panel.
 * Pure presentation — parent owns swipe state, panel refs, and all derived values.
 */
function OverviewPanels({
  // Card visibility + swipe
  showTrendCard,
  overviewSwipeHandlers,
  activeOverviewPanel,
  setActiveOverviewPanel,
  overviewPanelHeight,
  // Summary refs + values
  summaryPanelRef,
  dailyStats,
  calorieTarget,
  consumedCalories,
  caloriesProgressPercent,
  calorieStatus,
  isOverTarget,
  burnedCalories,
  extraCalories,
  burnProgress,
  isBalanced,
  watchBurned,
  stepsBurned,
  // Trend refs + values
  trendPanelRef,
  trendRangeDays,
  setTrendRangeDays,
  trendLoading,
  calorieTrendData,
  calorieChartRenderData,
  visibleNutritionDotIndices,
  visibleNutritionTickLabels,
  trendAverageCalories,
  trendBestDay,
  trendAboveTargetDays,
  renderCaloriePointLabel,
}) {
  return (
    <div className="px-3 md:px-4 mt-3 md:mt-5 mb-4">
      <div
        className={`w-full max-w-md mx-auto bg-white/70 backdrop-blur-xl rounded-2xl shadow-md border border-gray-100 overflow-hidden transition-all duration-500 ease-out ${
          showTrendCard ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-6'
        }`}
        {...overviewSwipeHandlers}
      >
        <div className="px-4 md:px-5 pt-4 md:pt-5 pb-2 flex items-center justify-between">
          <div className="text-xs md:text-sm text-gray-500">
            {activeOverviewPanel === 'summary'
              ? 'Daily Summary'
              : `Calorie Trend (${trendRangeDays}D)`}
          </div>
          <div className="flex items-center gap-1 bg-gray-100 rounded-full p-1">
            <button
              type="button"
              onClick={() => setActiveOverviewPanel('summary')}
              className={`px-2.5 py-1 text-[11px] md:text-xs rounded-full transition-all duration-300 ${
                activeOverviewPanel === 'summary'
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-white'
              }`}
            >
              Summary
            </button>
            <button
              type="button"
              onClick={() => setActiveOverviewPanel('trend')}
              className={`px-2.5 py-1 text-[11px] md:text-xs rounded-full transition-all duration-300 ${
                activeOverviewPanel === 'trend'
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-white'
              }`}
            >
              Trend
            </button>
          </div>
        </div>

        <div
          className="overflow-hidden transition-[height] duration-400 ease-out"
          style={
            overviewPanelHeight
              ? { height: `${overviewPanelHeight}px` }
              : undefined
          }
        >
          <div
            className="flex items-start w-[200%] transition-transform duration-500 ease-out"
            style={{
              transform:
                activeOverviewPanel === 'summary'
                  ? 'translateX(0%)'
                  : 'translateX(-50%)',
            }}
          >
            <NutritionSummaryCards
              summaryPanelRef={summaryPanelRef}
              dailyStats={dailyStats}
              calorieTarget={calorieTarget}
              consumedCalories={consumedCalories}
              caloriesProgressPercent={caloriesProgressPercent}
              calorieStatus={calorieStatus}
              isOverTarget={isOverTarget}
              burnedCalories={burnedCalories}
              extraCalories={extraCalories}
              burnProgress={burnProgress}
              isBalanced={isBalanced}
              watchBurned={watchBurned}
              stepsBurned={stepsBurned}
            />

            <NutritionFilters
              trendRangeDays={trendRangeDays}
              setTrendRangeDays={setTrendRangeDays}
              trendLoading={trendLoading}
              calorieTrendData={calorieTrendData}
              calorieChartRenderData={calorieChartRenderData}
              visibleNutritionDotIndices={visibleNutritionDotIndices}
              visibleNutritionTickLabels={visibleNutritionTickLabels}
              trendAverageCalories={trendAverageCalories}
              trendBestDay={trendBestDay}
              trendAboveTargetDays={trendAboveTargetDays}
              calorieTarget={calorieTarget}
              renderCaloriePointLabel={renderCaloriePointLabel}
              trendPanelRef={trendPanelRef}
            />
          </div>
        </div>

        <div className="pb-3 md:pb-4 flex items-center justify-center gap-1.5">
          <button
            type="button"
            aria-label="Go to summary slide"
            onClick={() => setActiveOverviewPanel('summary')}
            style={{ width: 7, height: 7, minWidth: 0, minHeight: 0, padding: 0 }}
            className={`rounded-full transition-all duration-300 ${
              activeOverviewPanel === 'summary'
                ? 'bg-emerald-500'
                : 'bg-gray-300 hover:bg-gray-400'
            }`}
          />
          <button
            type="button"
            aria-label="Go to trend slide"
            onClick={() => setActiveOverviewPanel('trend')}
            style={{ width: 7, height: 7, minWidth: 0, minHeight: 0, padding: 0 }}
            className={`rounded-full transition-all duration-300 ${
              activeOverviewPanel === 'trend'
                ? 'bg-emerald-500'
                : 'bg-gray-300 hover:bg-gray-400'
            }`}
          />
        </div>
      </div>
    </div>
  );
}

export default OverviewPanels;
