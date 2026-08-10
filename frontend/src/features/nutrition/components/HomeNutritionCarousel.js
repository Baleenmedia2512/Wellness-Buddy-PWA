/**

 * HomeNutritionCarousel

 * ---------------------

 * Self-contained carousel shown on the Home screen.

 * Date pill filter above the carousel drives nutrition + wellness for all slides.

 */

import React, { useCallback, useMemo, useRef, useState } from 'react';

import { isFlagEnabled } from '../../../config/featureFlags';

import ReportDateRangeFilter from '../../../shared/components/common/ReportDateRangeFilter';

import { HOME_NUTRITION_DATE_RANGES } from '../../../shared/domain/reportDateRanges';

import { useBusinessToday } from '../../../shared/hooks/useBusinessToday';

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
  watchBurnedCalories = 0,
  onOpenWellnessScore,
  onOpenWellnessScoreSetup,
  /** Controlled date range from App — keeps Home ↔ Wellness Score sheet in sync. */
  dateRange: dateRangeProp,
  customStartDate: customStartDateProp,
  customEndDate: customEndDateProp,
  onDateRangeChange: onDateRangeChangeProp,
}) {
  const today = useBusinessToday(user);
  const [dateRangeLocal, setDateRangeLocal] = useState('today');
  const [customStartDateLocal, setCustomStartDateLocal] = useState(null);
  const [customEndDateLocal, setCustomEndDateLocal] = useState(null);

  const isControlled = dateRangeProp !== undefined;
  const dateRange = isControlled ? dateRangeProp : dateRangeLocal;
  const customStartDate = isControlled ? (customStartDateProp ?? null) : customStartDateLocal;
  const customEndDate = isControlled ? (customEndDateProp ?? null) : customEndDateLocal;

  const resolveUserId = useResolveUserId({ user, apiBaseUrl });
  const { calorieTarget, bmrLoading } = useUserCalorieTarget({ user, apiBaseUrl, bmrUpdateKey });
  const { latestWeight, gender } = useUserLatestWeight({ user, apiBaseUrl });

  const carouselData = useHomeCarouselData({
    user,
    apiBaseUrl,
    resolveUserId,
    nutritionRefreshKey,
    watchBurnedCalories,
    dateRange,
    customStartDate,
    customEndDate,
    today,
  });

  const handleDateRangeChange = useCallback((nextRange) => {
    if (isControlled) {
      onDateRangeChangeProp?.({
        dateRange: nextRange,
        customStartDate: nextRange === 'custom' ? customStartDate : null,
        customEndDate: nextRange === 'custom' ? customEndDate : null,
      });
      return;
    }
    setDateRangeLocal(nextRange);
    if (nextRange !== 'custom') {
      setCustomStartDateLocal(null);
      setCustomEndDateLocal(null);
    }
  }, [isControlled, onDateRangeChangeProp, customStartDate, customEndDate]);

  const handleCustomDateSelect = useCallback((start, end) => {
    if (isControlled) {
      onDateRangeChangeProp?.({
        dateRange: 'custom',
        customStartDate: start,
        customEndDate: end,
      });
      return;
    }
    setCustomStartDateLocal(start);
    setCustomEndDateLocal(end);
    setDateRangeLocal('custom');
  }, [isControlled, onDateRangeChangeProp]);

  /** Open full sheet on the same date range currently selected on Home. */
  const handleOpenWellnessScore = useCallback(() => {
    onOpenWellnessScore?.({
      dateRange,
      customStartDate,
      customEndDate,
    });
  }, [onOpenWellnessScore, dateRange, customStartDate, customEndDate]);

  const hasLoadedOnce = useRef(false);

  const isLoading = bmrLoading || carouselData.nutritionLoading || carouselData.wellnessLoading;

  if (!isLoading) hasLoadedOnce.current = true;

  const wellnessScoreCard = useMemo(() => {
    if (!user || !isFlagEnabled('ff.wellness-score-sheet') || !onOpenWellnessScore) return null;

    return (
      <WellnessScoreCarouselCard
        key="wellness-score"
        user={user}
        apiBaseUrl={apiBaseUrl}
        scoreData={carouselData.wellnessScore}
        loading={carouselData.wellnessLoading}
        // Single-day (Today/Yesterday): live /daily fetch so Home stays in sync with sheet.
        liveScoreDate={carouselData.isMultiDay ? null : carouselData.rangeKey}
        scoreSubtitle={carouselData.wellnessSubtitle}
        periodContext={carouselData.periodContext}
        onOpen={handleOpenWellnessScore}
        onOpenSetup={onOpenWellnessScoreSetup}
        nutritionRefreshKey={nutritionRefreshKey}
      />
    );
  }, [
    user,
    apiBaseUrl,
    handleOpenWellnessScore,
    onOpenWellnessScore,
    onOpenWellnessScoreSetup, nutritionRefreshKey,
    carouselData.wellnessScore,
    carouselData.wellnessLoading,
    carouselData.wellnessSubtitle,
    carouselData.periodContext,
    carouselData.isMultiDay,
    carouselData.rangeKey,
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

            ranges={HOME_NUTRITION_DATE_RANGES}

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

        gender={gender}

        analyses={carouselData.analyses}

        leadingCard={wellnessScoreCard}

        periodContext={carouselData.periodContext}

      />

    </div>

  );

}


