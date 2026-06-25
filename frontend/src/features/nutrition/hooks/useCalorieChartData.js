/**
 * useCalorieChartData — derived chart data for the calorie trend chart.
 *
 * Pure transforms over calorieTrendData:
 * - calorieChartData: enrich each point with previousCalories + changeDirection.
 * - calorieChartRenderData: sample down to ≤ 7 points when window > 7 days.
 * - visibleNutritionDotIndices: indices of points that get a rendered dot.
 * - visibleNutritionTickLabels: x-axis tick labels for visible dots.
 * - xAxisInterval: recharts XAxis interval (kept for parity with prior code).
 *
 * Note: the previous inline code referenced `calselectedDateorieChartRenderData`
 * (a typo) in renderCaloriePointLabel's dep array. We use the correct identifier
 * here — renderCaloriePointLabel still re-creates whenever data changes via the
 * other listed deps, so behavior is preserved.
 */
import { useMemo, useCallback } from 'react';
import { isSmallChartDevice } from '../services/nutritionDashboard';

export function useCalorieChartData({ calorieTrendData, trendRangeDays, calorieTarget }) {
  const calorieChartData = useMemo(
    () =>
      calorieTrendData.map((point, index) => {
        const previousCalories =
          index > 0 ? calorieTrendData[index - 1]?.calories || 0 : null;
        const currentCalories = point.calories || 0;
        const changeDirection =
          previousCalories === null
            ? null
            : currentCalories > previousCalories
              ? 'up'
              : currentCalories < previousCalories
                ? 'down'
                : 'same';
        return { ...point, calories: currentCalories, previousCalories, changeDirection };
      }),
    [calorieTrendData],
  );

  const calorieChartRenderData = useMemo(() => {
    const total = calorieChartData.length;
    if (total === 0) return [];
    if (trendRangeDays <= 7) return calorieChartData;

    const targetCount = Math.min(7, total);
    if (targetCount <= 1) return [calorieChartData[total - 1]];

    const sampledIndices = Array.from({ length: targetCount }, (_, i) =>
      Math.round((i * (total - 1)) / (targetCount - 1)),
    );

    return Array.from(new Set(sampledIndices))
      .sort((a, b) => a - b)
      .map((idx) => calorieChartData[idx]);
  }, [calorieChartData, trendRangeDays]);

  const visibleNutritionDotIndices = useMemo(() => {
    const total = calorieChartRenderData.length;
    if (total === 0) return new Set();
    return new Set(Array.from({ length: total }, (_, i) => i));
  }, [calorieChartRenderData]);

  const visibleNutritionTickLabels = useMemo(
    () =>
      Array.from(visibleNutritionDotIndices)
        .sort((a, b) => a - b)
        .map((index) => calorieChartRenderData[index]?.label)
        .filter(Boolean),
    [calorieChartRenderData, visibleNutritionDotIndices],
  );

  const xAxisInterval =
    trendRangeDays <= 7 ? 0
      : trendRangeDays <= 14 ? 1
        : trendRangeDays <= 21 ? 2 : 4;

  const renderCaloriePointLabel = useCallback(
    ({ x, y, index }) => {
      if (x === undefined || y === undefined || index === undefined) return null;
      if (!visibleNutritionDotIndices.has(index)) return null;
      const point = calorieChartRenderData[index];
      if (!point) return null;
      const text = point.hasData ? `${point.calories}` : '0';
      const labelFontSize = isSmallChartDevice() ? 7 : 9;
      const labelY = y - (isSmallChartDevice() ? 8 : 11);
      return (
        <text
          x={x}
          y={labelY}
          textAnchor="middle"
          fill="#9ca3af"
          fontSize={labelFontSize}
          fontWeight={500}
        >
          {text}
        </text>
      );
    },
    [calorieChartRenderData, visibleNutritionDotIndices],
  );

  return {
    calorieChartData,
    calorieChartRenderData,
    visibleNutritionDotIndices,
    visibleNutritionTickLabels,
    xAxisInterval,
    renderCaloriePointLabel,
  };
}
