/**
 * HomeNutritionCarousel
 * ---------------------
 * Self-contained carousel shown on the Home screen.
 * Date pill filter above the carousel drives nutrition + wellness for all slides.
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { isFlagEnabled } from '../../../config/featureFlags';
import ReportDateRangeFilter from '../../../shared/components/common/ReportDateRangeFilter';
import { WELLNESS_SCORE_DATE_RANGES } from '../../../shared/domain/reportDateRanges';
import { useISTToday } from '../../wellness-score-sheet/hooks/useISTToday';
import WellnessScoreCarouselCard from '../../wellness-score-sheet/components/WellnessScoreCarouselCard';
import {
  useUserCalorieTarget,
  useUserLatestWeight,
  useResolveUserId,
  useHomeCarouselData,
} from '../hooks';
import NutritionCarousel from './dashboard/NutritionCarousel';

export default function HomeNutritionCarousel({
  user,
  apiBaseUrl,
  bmrUpdateKey = 0,
  nutritionRefreshKey = 0,
  onOpenWellnessScore,
  onOpenWellnessScoreSetup,
}) {
  const today = useISTToday();
  const [dateRange, setDateRange] = useState('today');
  const [customStartDate, setCustomStartDate] = useState(null);
  const [customEndDate, setCustomEndDate] = useState(null);

  const resolveUserId = useResolveUserId({ user, apiBaseUrl });
  const { calorieTarget, bmrLoading } = useUserCalorieTarget({ user, apiBaseUrl, bmrUpdateKey });
  const latestWeight = useUserLatestWeight({ user, apiBaseUrl });

  const carouselData = useHomeCarouselData({
    user,
    apiBaseUrl,
    resolveUserId,
    nutritionRefreshKey,
    dateRange,
    customStartDate,
    customEndDate,
    today,
  });

  const handleDateRangeChange = useCallback((nextRange) => {
    setDateRange(nextRange);
  }, []);

  const handleCustomDateSelect = useCallback((start, end) => {
    setCustomStartDate(start);
    setCustomEndDate(end);
    setDateRange('custom');
  }, []);

  const hasLoadedOnce = useRef(false);
  const isLoading = bmrLoading || carouselData.nutritionLoading || carouselData.wellnessLoading;
  if (!isLoading) hasLoadedOnce.current = true;

  const wellnessScoreCard = useMemo(() => {
    if (!user || !isFlagEnabled('ff.wellness-score-sheet') || !onOpenWellnessScore) return null;
    return (
      <WellnessScoreCarouselCard
        key="wellness-score"
        user={user}
        scoreData={carouselData.wellnessScore}
        loading={carouselData.wellnessLoading}
        scoreSubtitle={carouselData.wellnessSubtitle}
        periodContext={carouselData.periodContext}
        onOpen={onOpenWellnessScore}
        onOpenSetup={onOpenWellnessScoreSetup}
      />
    );
  }, [
    user,
    onOpenWellnessScore,
    onOpenWellnessScoreSetup,
    carouselData.wellnessScore,
    carouselData.wellnessLoading,
    carouselData.wellnessSubtitle,
    carouselData.periodContext,
  ]);

  if (!user) return null;

  if (!hasLoadedOnce.current && isLoading) {
    return (
      <div className="px-2 md:px-3 mb-2 space-y-2">
        <div className="w-full max-w-md mx-auto h-10 bg-white/70 rounded-full animate-pulse" />
        <div className="w-full max-w-md mx-auto bg-white/70 rounded-xl shadow-md border border-gray-100 min-h-[180px] animate-pulse" />
      </div>
    );
  }

  return (
    <div className="mb-2">
      <div className="px-2 md:px-3 mb-2">
        <div className="w-full max-w-md mx-auto">
          <ReportDateRangeFilter
            ranges={WELLNESS_SCORE_DATE_RANGES}
            dateRange={dateRange}
            onDateRangeChange={handleDateRangeChange}
            customStartDate={customStartDate}
            customEndDate={customEndDate}
            onCustomDateSelect={handleCustomDateSelect}
          />
          {carouselData.periodContext?.progressHint && carouselData.periodContext.isMultiDay && (
            <p className="mt-1.5 text-center text-xs font-medium text-gray-500">
              {carouselData.periodContext.progressHint}
            </p>
          )}
        </div>
      </div>

      <NutritionCarousel
        calorieTarget={calorieTarget}
        consumedCalories={carouselData.dailyStats.totalCalories}
        burnedCalories={carouselData.burnedCalories}
        dailyStats={carouselData.dailyStats}
        latestWeight={latestWeight}
        selectedDate={carouselData.selectedDate}
        rangeKey={carouselData.rangeKey}
        analyses={carouselData.analyses}
        leadingCard={wellnessScoreCard}
        periodContext={carouselData.periodContext}
      />
    </div>
  );
}
