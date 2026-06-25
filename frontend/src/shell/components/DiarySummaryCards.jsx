/**
 * DiarySummaryCards.jsx — summary + trend cards for the Reports page.
 *
 * Each feature card is a swipeable carousel identical to the original tabs:
 * swipe left (or tap Trend) to see the trend chart, swipe right (or tap
 * Summary) to return to the summary view. Dots + toggle button both work.
 *
 * The shell layer is permitted to import from features/* (see shell/README).
 */
import React from 'react';
import {
  NutritionSummaryCards,
  NutritionFilters,
  useUserCalorieTarget,
  useBurnedCalories,
  useResolveUserId,
  useDayAnalyses,
  useCalorieTrend,
  useCalorieChartData,
} from '../../features/nutrition';
import {
  WeightSummaryCards,
  WeightChart,
  useWeightDashboard,
} from '../../features/weight';
import {
  EducationSummaryCards,
  EducationTrendPanel,
  useEducationDashboard,
} from '../../features/education';

// Reusable swipe-to-slide panel wrapper — identical pattern to EducationDashboardHeader
// and WeightDashboard. Uses render props so refs pass directly to each slide's root
// element (inner components already have w-1/2 shrink-0 built in).
const TREND_RANGE = 7;
function SwipeableCard({ title, summaryLabel, trendLabel, renderSummary, renderTrend }) {
  const [active, setActive] = React.useState('summary');
  const [panelHeight, setPanelHeight] = React.useState(null);
  const swipeRef = React.useRef({ active: false, startX: 0, lastX: 0 });
  const summaryRef = React.useRef(null);
  const trendRef = React.useRef(null);

  const onPointerDown = (e) => {
    if (!e.isPrimary) return;
    swipeRef.current = { active: true, startX: e.clientX, lastX: e.clientX };
  };
  const onPointerMove = (e) => {
    if (!swipeRef.current.active || !e.isPrimary) return;
    swipeRef.current.lastX = e.clientX;
  };
  const onPointerEnd = () => {
    const s = swipeRef.current;
    if (!s.active) return;
    s.active = false;
    const dx = s.lastX - s.startX;
    if (Math.abs(dx) < 36) return;
    setActive(dx < 0 ? 'trend' : 'summary');
  };

  React.useEffect(() => {
    const measure = () => {
      const ref = active === 'summary' ? summaryRef : trendRef;
      if (ref.current) setPanelHeight(ref.current.scrollHeight);
    };
    const id = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    return () => { cancelAnimationFrame(id); window.removeEventListener('resize', measure); };
  }, [active]);

  return (
    <div
      className="w-full max-w-md mx-auto bg-white/70 backdrop-blur-xl rounded-2xl border border-gray-200/60 shadow-sm overflow-hidden mt-3 mb-4"
      onPointerDown={onPointerDown} onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd} onPointerCancel={onPointerEnd} onPointerLeave={onPointerEnd}
    >
      <div className="px-4 md:px-5 pt-4 md:pt-5 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">{title}</span>
          <span className="text-xs md:text-sm text-gray-500">
            {active === 'summary' ? summaryLabel : trendLabel}
          </span>
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-full p-0.5">
          <button type="button" onClick={() => setActive('summary')}
            className={`px-2 py-0.5 text-[10px] rounded-full transition-all duration-300 ${
              active === 'summary' ? 'bg-emerald-500 text-white shadow-sm' : 'text-gray-600 hover:bg-white'
            }`}>Summary</button>
          <button type="button" onClick={() => setActive('trend')}
            className={`px-2 py-0.5 text-[10px] rounded-full transition-all duration-300 ${
              active === 'trend' ? 'bg-emerald-500 text-white shadow-sm' : 'text-gray-600 hover:bg-white'
            }`}>Trend</button>
        </div>
      </div>

      <div className="overflow-hidden transition-[height] duration-400 ease-out"
        style={panelHeight ? { height: `${panelHeight}px` } : undefined}>
        {/* Inner components already carry w-1/2 shrink-0 on their root — render directly */}
        <div className="flex items-start w-[200%] transition-transform duration-500 ease-out"
          style={{ transform: active === 'summary' ? 'translateX(0%)' : 'translateX(-50%)' }}>
          {renderSummary(summaryRef)}
          {renderTrend(trendRef)}
        </div>
      </div>

      <div className="pb-3 flex items-center justify-center gap-2">
        {['summary', 'trend'].map((s) => (
          <button key={s} type="button" aria-label={`${s} slide`} onClick={() => setActive(s)}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              active === s ? 'w-6 bg-emerald-500' : 'w-2.5 bg-gray-300'
            }`} />
        ))}
      </div>
    </div>
  );
}

const NutritionSummary = React.memo(function NutritionSummary({ user, apiBaseUrl, selectedDate, bmrUpdateKey, watchBurnedCalories }) {
  const resolveUserId = useResolveUserId({ user, apiBaseUrl });
  const { calorieTarget } = useUserCalorieTarget({ user, apiBaseUrl, bmrUpdateKey });
  const { burnedCalories, watchBurned, stepsBurned } = useBurnedCalories({
    user, selectedDate, apiBaseUrl, resolveUserId, watchBurnedCalories,
  });
  const { dailyStats } = useDayAnalyses({ user, selectedDate, apiBaseUrl, resolveUserId });

  // Derived values — mirror NutritionDashboard so the card reads identically.
  const consumedCalories = dailyStats?.totalCalories || 0;
  const caloriesProgressPercent = Math.min(
    100, (consumedCalories / Math.max(calorieTarget, 1)) * 100,
  );
  const caloriesDelta = consumedCalories - calorieTarget;
  const calorieStatus =
    Math.abs(caloriesDelta) <= 100
      ? { label: 'On Track', className: 'bg-emerald-50 text-emerald-700', hint: 'Great balance for today' }
      : caloriesDelta > 100
        ? { label: 'Above Target', className: 'bg-rose-50 text-rose-700', hint: `${Math.abs(caloriesDelta)} kcal above target` }
        : { label: 'Below Target', className: 'bg-amber-50 text-amber-700', hint: `${Math.abs(caloriesDelta)} kcal below target` };
  const isOverTarget = consumedCalories > calorieTarget;
  const extraCalories = isOverTarget ? Math.round(consumedCalories - calorieTarget) : 0;
  const burnProgress = extraCalories > 0
    ? Math.min(100, Math.round((burnedCalories / extraCalories) * 100)) : 0;
  const isBalanced = isOverTarget && burnedCalories >= extraCalories;

  // ── Calorie trend ───────────────────────────────────────────────
  const { calorieTrendData, trendLoading } = useCalorieTrend({
    user, selectedDate, trendRangeDays: TREND_RANGE, apiBaseUrl, resolveUserId, calorieTarget,
  });
  const trendAverageCalories = calorieTrendData.length
    ? Math.round(calorieTrendData.reduce((s, d) => s + (d.calories || 0), 0) / calorieTrendData.length)
    : 0;
  const trendAboveTargetDays = calorieTrendData.filter((d) => (d.calories || 0) > calorieTarget).length;
  const trendBestDay = calorieTrendData.reduce((best, day) => {
    const dd = Math.abs((day.calories || 0) - calorieTarget);
    const bd = best ? Math.abs((best.calories || 0) - calorieTarget) : Number.POSITIVE_INFINITY;
    return dd < bd ? day : best;
  }, null);
  const {
    calorieChartRenderData, visibleNutritionDotIndices,
    visibleNutritionTickLabels, renderCaloriePointLabel,
  } = useCalorieChartData({ calorieTrendData, trendRangeDays: TREND_RANGE, calorieTarget });

  return (
    <SwipeableCard
      title="🍽️"
      summaryLabel="Nutrition Summary"
      trendLabel="Calorie Trend"
      renderSummary={(ref) => (
        <NutritionSummaryCards
          summaryPanelRef={ref}
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
      )}
      renderTrend={(ref) => (
        <NutritionFilters
          trendPanelRef={ref}
          trendRangeDays={TREND_RANGE}
          setTrendRangeDays={() => {}}
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
        />
      )}
    />
  );
});

const WeightSummary = React.memo(function WeightSummary({ user, apiBaseUrl }) {
  const vm = useWeightDashboard({ user, apiBaseUrl });
  const latestWeight = vm.weightHistory?.[0] || null;
  const previousWeight = vm.weightHistory?.[1]?.Weight ?? null;
  return (
    <SwipeableCard
      title="⚖️"
      summaryLabel="Weight Summary"
      trendLabel={`Weight Trend (${vm.weightTrendRangeDays}D)`}
      renderSummary={(ref) => (
        <WeightSummaryCards
          summaryRef={ref}
          latestWeight={latestWeight}
          previousWeight={previousWeight}
          globalStats={vm.globalStats}
        />
      )}
      renderTrend={(ref) => (
        <WeightChart
          trendRef={ref}
          chartRef={vm.weightTrendChartRef}
          weightTrendSeries={vm.weightTrendSeries}
          weightTrendChartWidth={vm.weightTrendChartWidth}
          weightTrendRangeDays={vm.weightTrendRangeDays}
          setWeightTrendRangeDays={vm.setWeightTrendRangeDays}
        />
      )}
    />
  );
});

const EducationSummary = React.memo(function EducationSummary({ user, apiBaseUrl, refreshKey }) {
  const vm = useEducationDashboard({ user, apiBaseUrl, refreshKey });
  return (
    <SwipeableCard
      title="🎓"
      summaryLabel="Education Summary"
      trendLabel={`Education Trend (${vm.trendRangeDays}D)`}
      renderSummary={(ref) => (
        <EducationSummaryCards
          ref={ref}
          summary={vm.summary}
          summaryLoading={vm.summaryLoading}
          educationLogs={vm.educationLogs}
        />
      )}
      renderTrend={(ref) => (
        <EducationTrendPanel
          ref={ref}
          series={vm.trendSeries}
          rangeDays={vm.trendRangeDays}
          onRangeChange={vm.setTrendRangeDays}
        />
      )}
    />
  );
});

export default function DiarySummaryCards({
  user, apiBaseUrl, selectedDate, bmrUpdateKey = 0, educationRefreshKey = 0, watchBurnedCalories = 0,
}) {
  return (
    <div className="space-y-3 mb-3" data-testid="diary-summary-cards">
      <NutritionSummary
        user={user}
        apiBaseUrl={apiBaseUrl}
        selectedDate={selectedDate}
        bmrUpdateKey={bmrUpdateKey}
        watchBurnedCalories={watchBurnedCalories}
      />
      <WeightSummary user={user} apiBaseUrl={apiBaseUrl} />
      <EducationSummary user={user} apiBaseUrl={apiBaseUrl} refreshKey={educationRefreshKey} />
    </div>
  );
}
