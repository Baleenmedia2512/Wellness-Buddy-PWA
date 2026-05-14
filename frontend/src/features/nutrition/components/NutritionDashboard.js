import React, { useState, useEffect, useCallback, useRef } from "react";
import { AlertCircle } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import "../../../LazyLoadStyles.css";
import { geminiService } from "../../../shared/services/geminiService";
import {
  isMobileDevice,
  generateScrollableDates,
  transformDbItemToEditable,
  parseAnalysisData,
} from "../services/nutritionDashboard";
import {
  NutritionMealList,
  DashboardHeader,
  HorizontalCalendarStrip,
  OverviewPanels,
  MealAnalysisModal,
} from "./dashboard";
import {
  useUserCalorieTarget,
  useBurnedCalories,
  useCalorieTrend,
  useCalorieChartData,
  useResolveUserId,
  useDayAnalyses,
  useInfiniteScroll,
  useSwipePanelHeight,
  useMealMutations,
} from "../hooks";

const UNDO_SECONDS = 5; // cooldown duration

/**
 * NutritionDashboard
 * -----------------------------------------------------------------------------
 * ROLE: Orchestrator shell for the nutrition feature.
 *
 * This component is intentionally NOT a presentation component. Its job is to:
 *   1. Compose feature-scoped hooks (data fetching, swipe state, mutations,
 *      derived chart data) and wire their outputs together.
 *   2. Compute lightweight derived values that several presentation children
 *      need (calorie status label, burn-to-balance percentages, trend
 *      aggregates).
 *   3. Mount the dumb presentation components from `./dashboard/` and pass
 *      them everything they need via explicit props.
 *
 * WHY HOOKS OWN ASYNC ORCHESTRATION:
 *   All async / side-effectful work (Supabase fetches, retry/refresh, infinite
 *   scroll, meal mutations, swipe panel height measurement, calorie chart
 *   transforms) is encapsulated in `../hooks/`. Hooks own:
 *     - data shape and loading/error state for that concern,
 *     - cleanup of subscriptions, timers, and observers,
 *     - cross-call invariants (optimistic updates + rollback for mutations).
 *   This keeps each concern testable in isolation and lets this component stay
 *   focused on composition rather than effect bookkeeping.
 *
 * WHY PRESENTATION COMPONENTS REMAIN DUMB:
 *   Components in `./dashboard/` (DashboardHeader, HorizontalCalendarStrip,
 *   InlineCalendarPanel, OverviewPanels, MealAnalysisModal,
 *   NutritionSummaryCards, NutritionFilters, NutritionMealList,
 *   NutritionAnalysisPanel, MealCard, UndoRow) own no async work and no shared
 *   state. They receive values + setters as props and render. This makes them:
 *     - trivial to reason about and unit-test,
 *     - swappable / restyle-able without touching orchestration,
 *     - safe to memoize later without hidden coupling to feature data flow.
 *
 * If you find yourself adding a `useEffect` with a fetch inside a presentation
 * component, lift it into a hook here instead.
 * -----------------------------------------------------------------------------
 */
const NutritionDashboard = ({
  user,
  onBack,
  apiBaseUrl,
  onMealDelete,
  hideHeader,
  selectedDate: propSelectedDate,
  setSelectedDate: propSetSelectedDate,
  bmrUpdateKey = 0,
  watchBurnedCalories = 0, // calories from a just-saved watch image (pushed from App.js)
}) => {
  const isIOS = Capacitor.getPlatform() === "ios";
  // Use parent's selectedDate if provided, otherwise use local state
  const [localSelectedDate, setLocalSelectedDate] = useState(new Date());
  const selectedDate = propSelectedDate || localSelectedDate;
  const setSelectedDate = propSetSelectedDate || setLocalSelectedDate;
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [selectedMeal, setSelectedMeal] = useState(null);
  const [isClosingModal, setIsClosingModal] = useState(false);

  // Editable food items state
  const [localDetailedItems, setLocalDetailedItems] = useState([]);
  const [localNutrition, setLocalNutrition] = useState({});
  const [isEditing, setIsEditing] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // 'success' | 'error' | null
  const [editingStates, setEditingStates] = useState({});
  // eslint-disable-next-line no-unused-vars -- value unread; setter retained for re-render side effect
  const [editingIndex, setEditingIndex] = useState(null);
  const [resetKey] = useState(0);
  const itemRefs = useRef({});

  // undo placeholders: key -> { originalMeal, expiresAt }
  const [undoState, setUndoState] = useState({});

  // Track when update is from auto-save to prevent UI reset
  const isAutoSaveUpdateRef = useRef(false);

  const watchUploadRef = useRef(null);
  const [trendRangeDays, setTrendRangeDays] = useState(7);

  const resolveUserId = useResolveUserId({ user, apiBaseUrl });

  // Day analyses + daily stats orchestration (auto-fetch on user/date change).
  const {
    analyses,
    setAnalyses,
    dailyStats,
    loading,
    error,
    setError,
    fetchDayAnalyses,
    applyDailyDelta,
  } = useDayAnalyses({ user, selectedDate, apiBaseUrl, resolveUserId });

  // Calorie target from user's BMR (fallback handled inside the hook)
  const calorieTarget = useUserCalorieTarget({ user, apiBaseUrl, bmrUpdateKey });

  // Burn-to-Balance: today's calories burned (steps disabled, watch-derived only)
  const { burnedCalories, watchBurned, stepsBurned } = useBurnedCalories({
    user,
    selectedDate,
    apiBaseUrl,
    resolveUserId,
    watchBurnedCalories,
  });

  // Multi-day calorie totals for the trend chart
  const { calorieTrendData, trendLoading, showTrendCard } = useCalorieTrend({
    user,
    selectedDate,
    trendRangeDays,
    apiBaseUrl,
    resolveUserId,
    calorieTarget,
  });

  // Overview panel swipe + dynamic height (re-measure when content changes).
  const {
    activeOverviewPanel,
    setActiveOverviewPanel,
    overviewPanelHeight,
    summaryPanelRef,
    trendPanelRef,
    swipeHandlers: overviewSwipeHandlers,
  } = useSwipePanelHeight({
    heightDeps: [trendLoading, calorieTrendData, trendRangeDays, dailyStats],
  });

  // Infinite scroll pagination over analyses.
  const { displayedMeals, hasMoreMeals, loadingMore, sentinelRef } =
    useInfiniteScroll({ analyses, perPage: 10 });

  // Meal mutations: per-item edits + optimistic row delete with undo/rollback.
  const {
    isSaving,
    setIsSaving,
    handleFoodUpdate,
    handleDeleteFoodItem,
    handleRestoreFoodItem,
    deletingId,
    handleDeleteMeal,
    handleOptimisticDelete,
  } = useMealMutations({
    apiBaseUrl,
    user,
    selectedMeal,
    setSelectedMeal,
    selectedDate,
    resolveUserId,
    setAnalyses,
    setUndoState,
    setError,
    applyDailyDelta,
    fetchDayAnalyses,
    localDetailedItems,
    setLocalDetailedItems,
    localNutrition,
    setLocalNutrition,
    isAutoSaveUpdateRef,
    onMealDelete,
    undoSeconds: UNDO_SECONDS,
  });

  // Initialize local editable data when meal changes
  useEffect(() => {
    if (selectedMeal) {
      const foodData = parseAnalysisData(selectedMeal.AnalysisData);

      // Ã°Å¸â€Â DEBUG: Log what we're loading from database
      console.log("Ã°Å¸â€Â [NutritionDashboard] Loading from database:", {
        foods: foodData.detailedItems?.map((item) => ({
          name: item.name,
          weight_g: item.weight_g,
          volume_ml: item.volume_ml,
          grams: item.grams,
          unit: item.unit,
          isLiquid: item.isLiquid,
          portion: item.portion,
        })),
      });

      // Transform database format to EditableFoodItem expected format
      const transformedItems = (foodData.detailedItems || []).map((item) => {
        const transformed = transformDbItemToEditable(item);
        console.log("[NutritionDashboard] Transformed item:", {
          name: item.name,
          originalAiName: transformed.originalAiName,
          wasAutoCorrected: transformed.wasAutoCorrected,
          needsReverseLookup: transformed.needsReverseLookup,
          correctionMetadataAiDetected: item.correctionMetadata?.aiDetected,
        });
        return transformed;
      });
      setLocalDetailedItems(transformedItems);
      setLocalNutrition(foodData.nutrition || {});

      // Only reset editing states if NOT from auto-save
      if (!isAutoSaveUpdateRef.current) {
        setIsEditing(false);
        setEditingStates({});
      }

      // Reset the flag
      isAutoSaveUpdateRef.current = false;
    }
  }, [selectedMeal]);

  // Check if any item is being edited
  useEffect(() => {
    const anyEditing = Object.values(editingStates).some(
      (state) => state === true,
    );
    setIsEditing(anyEditing);
    // Track which item is being edited
    if (anyEditing) {
      const idx = Object.keys(editingStates).find((key) => editingStates[key]);
      setEditingIndex(idx !== undefined ? parseInt(idx) : null);
    } else {
      setEditingIndex(null);
    }
  }, [editingStates]);

  // Handle editing state change from EditableFoodItem
  const handleEditingChange = useCallback(
    (index, isItemEditing, isBlocking = false) => {
      setEditingStates((prev) => ({
        ...prev,
        [index]: isItemEditing,
      }));

      // Track if any item is actively saving/retrying (blocks modal close)
      setIsSaving(isBlocking);
    },
    [setIsSaving],
  );

  // Wrap shared persistMealItems with local state setters and saving flag.
  // persistMealItems + handleFoodUpdate / handleDeleteFoodItem / handleRestoreFoodItem
  // moved to useMealMutations hook (declared above).

  // ? PAGINATION STATE moved to useInfiniteScroll hook (declared above).

  /* ---------------- Helpers ---------------- */

  useEffect(() => {
    if (isMobileDevice()) {
      setTimeout(() => {
        const scrollableDates = generateScrollableDates(selectedDate);
        const selectedIndex = scrollableDates.findIndex(
          (d) => d.date.toDateString() === selectedDate.toDateString(),
        );
        if (selectedIndex !== -1) {
          const el = document.querySelector(
            `[data-date-index="${selectedIndex}"]`,
          );
          if (el)
            el.scrollIntoView({
              behavior: "smooth",
              block: "nearest",
              inline: "center",
            });
        }
      }, 100);
    }
    setShowCalendar(false);
  }, [selectedDate]);

  // fetchDayAnalyses + auto-refresh effect moved to useDayAnalyses hook.

  // â”€â”€â”€ Fetch burned calories from daily_step_activity for the selected date â”€â”€â”€â”€
  // STEP COUNTER DISABLED â€” entire fetchBurnedCalories function commented out
  /*
  const fetchBurnedCalories = useCallback(
    async (date) => {
      if (!user) return;
      setBurnedLoading(true);
      try {
        const actualUserId = await resolveUserId();
        if (!actualUserId) return;
        const dateStr =
          date.getFullYear() +
          "-" +
          String(date.getMonth() + 1).padStart(2, "0") +
          "-" +
          String(date.getDate()).padStart(2, "0");
        const res = await fetch(
          `${apiBaseUrl}/api/activity?userId=${actualUserId}&date=${dateStr}&activityType=walking&_t=${Date.now()}`,
          { cache: "no-store", headers: { "Cache-Control": "no-cache", Pragma: "no-cache" } },
        );
        const json = await res.json();
        // API returns { trend/data: [...] } â€” find the entry matching today's date
        const rows = json?.trend || json?.data || [];
        const todayRow = rows.find((r) => r.date === dateStr || r.activityDate === dateStr);
        const burned = todayRow?.caloriesBurned ?? todayRow?.CaloriesBurned ?? 0;
        const dbBurned = Math.round(Number(burned) || 0);
        setStepsBurned(dbBurned);
      } catch (err) {
        console.warn("[NutritionDashboard] fetchBurnedCalories failed:", err);
      } finally {
        setBurnedLoading(false);
      }
    },
    [user, apiBaseUrl, resolveUserId],
  );

  useEffect(() => {
    if (user) fetchBurnedCalories(selectedDate);
  }, [user, selectedDate, fetchBurnedCalories]);
  */

  // â”€â”€â”€ Smartwatch screenshot handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleWatchScreenshot = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      // Reset the input so the same file can be re-selected
      e.target.value = "";

      try {
        const result = await geminiService.analyzeWatchScreenshot(file);
        if (result.caloriesBurned > 0) {
          // NOTE: watch calories are managed via App.js watchBurnedCalories state (prop).
          // This legacy handler is no longer used â€” upload happens on main page via WatchActivityCard.
          console.log(
            `[BurnToBalance] ðŸ“· Extracted ${result.caloriesBurned} kcal burned from ${result.source} (confidence: ${result.confidence})`,
          );
        } else {
          console.warn("[BurnToBalance] Could not extract calories from screenshot.");
          alert("Could not read calories burned from this screenshot. Please try a clearer image showing the calories burned value.");
        }
      } catch (err) {
        console.error("[BurnToBalance] Screenshot analysis failed:", err);
        alert("Failed to analyze screenshot. Please check your connection and try again.");
      }
    },
    [],
  );

  // Overview swipe handlers + height measurement moved to useSwipePanelHeight hook.
  // Infinite scroll pagination moved to useInfiniteScroll hook.

  const formatDateHeader = (date) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
    });
  };

  const navigateDate = (direction) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(selectedDate.getDate() + direction);
    if (newDate <= new Date()) setSelectedDate(newDate);
  };

  const handleCloseModal = () => {
    // Prevent closing if currently saving/retrying or showing status
    if (isSaving || saveStatus) {
      return;
    }

    setIsClosingModal(true);
    setTimeout(() => {
      setSelectedMeal(null);
      setIsClosingModal(false);
    }, 300);
  };

  // Meal delete handlers (handleDeleteMeal, handleOptimisticDelete) moved to
  // useMealMutations hook (declared above). applyDailyDelta lives in useDayAnalyses.

  // Parent: pass this to <MealCard onDelete={...} />
  // handleOptimisticDelete moved to useMealMutations hook (declared above).

  const consumedCalories = dailyStats.totalCalories || 0;
  const caloriesProgressPercent = Math.min(
    100,
    (consumedCalories / Math.max(calorieTarget, 1)) * 100,
  );
  const caloriesDelta = consumedCalories - calorieTarget;
  const calorieStatus =
    Math.abs(caloriesDelta) <= 100
      ? {
          label: "On Track",
          className: "bg-emerald-50 text-emerald-700",
          hint: "Great balance for today",
        }
      : caloriesDelta > 100
        ? {
            label: "Above Target",
            className: "bg-rose-50 text-rose-700",
            hint: `${Math.abs(caloriesDelta)} kcal above target`,
          }
        : {
            label: "Below Target",
            className: "bg-amber-50 text-amber-700",
            hint: `${Math.abs(caloriesDelta)} kcal below target`,
          };

  // â”€â”€â”€ Burn-to-Balance derived values â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const isOverTarget   = consumedCalories > calorieTarget;
  const extraCalories  = isOverTarget ? Math.round(consumedCalories - calorieTarget) : 0;
  const burnProgress   = extraCalories > 0
    ? Math.min(100, Math.round((burnedCalories / extraCalories) * 100))
    : 0;
  const isBalanced     = isOverTarget && burnedCalories >= extraCalories;

  const trendAverageCalories = calorieTrendData.length
    ? Math.round(
        calorieTrendData.reduce((sum, d) => sum + (d.calories || 0), 0) /
          calorieTrendData.length,
      )
    : 0;
  const trendAboveTargetDays = calorieTrendData.filter(
    (d) => (d.calories || 0) > calorieTarget,
  ).length;
  const trendBestDay = calorieTrendData.reduce(
    (best, day) => {
      const dayDiff = Math.abs((day.calories || 0) - calorieTarget);
      const bestDiff = best
        ? Math.abs((best.calories || 0) - calorieTarget)
        : Number.POSITIVE_INFINITY;
      if (dayDiff < bestDiff) return day;
      return best;
    },
    null,
  );

  const {
    calorieChartRenderData,
    visibleNutritionDotIndices,
    visibleNutritionTickLabels,
    renderCaloriePointLabel,
  } = useCalorieChartData({ calorieTrendData, trendRangeDays, calorieTarget });

  /* ---------------- UI ---------------- */

  return (
    <div className="min-h-screen bg-gray-50">
      {/* keyframes (once) */}
      <style>{`@keyframes countdown-shrink { from { transform: scaleX(1); } to { transform: scaleX(0); } }`}</style>

      {/* Hidden file input for smartwatch screenshot upload */}
      <input
        ref={watchUploadRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleWatchScreenshot}
      />

      {/* Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -right-20 w-40 h-40 md:w-80 md:h-80 bg-gradient-to-br from-orange-200/20 to-pink-200/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-20 -left-20 w-40 h-40 md:w-80 md:h-80 bg-gradient-to-tr from-blue-200/20 to-purple-200/20 rounded-full blur-3xl"></div>
      </div>

      {/* Header - Only show if not hidden */}
      {!hideHeader && (
        <DashboardHeader
          onBack={onBack}
          selectedDate={selectedDate}
          formatDateHeader={formatDateHeader}
          showCalendar={showCalendar}
          setShowCalendar={setShowCalendar}
        />
      )}

      {/* Date selector */}
      <HorizontalCalendarStrip
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        navigateDate={navigateDate}
        showCalendar={showCalendar}
        setShowCalendar={setShowCalendar}
        calendarMonth={calendarMonth}
        setCalendarMonth={setCalendarMonth}
      />
      {/* Content */}
      <div className="w-full md:max-w-2xl lg:max-w-4xl md:mx-auto pb-4 md:pb-6">
        {loading ? (
          <div className="w-full md:max-w-2xl lg:max-w-4xl md:mx-auto pb-24 mt-2 animate-pulse">
            <div className="px-3 md:px-4 mt-3 md:mt-5 mb-4">
              {/* Summary Card Skeleton */}
              <div className="w-full max-w-md mx-auto bg-white rounded-2xl shadow-sm border border-gray-200/60 p-4 md:p-5">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <div className="h-3 w-24 bg-gray-200 rounded mb-2 animate-pulse"></div>
                    <div className="h-8 w-32 bg-gray-200 rounded animate-pulse"></div>
                  </div>
                  <div className="h-6 w-20 bg-gray-200 rounded-full animate-pulse"></div>
                </div>
                <div className="h-2 w-full bg-gray-200 rounded-full mb-4 animate-pulse"></div>
                <div className="flex justify-between gap-2">
                  {[...Array(4)].map((_, i) => (
                    <div
                      key={i}
                      className="flex-1 h-16 bg-gray-200 rounded-lg animate-pulse"
                    ></div>
                  ))}
                </div>
              </div>
            </div>

            {/* Meal List Skeletons */}
            <div className="px-4 md:px-6 space-y-6">
              {[...Array(3)].map((_, i) => (
                <div key={i}>
                  <div className="flex justify-between items-center mb-3 px-2">
                    <div className="h-4 w-32 bg-gray-200 rounded animate-pulse"></div>
                    <div className="h-4 w-16 bg-gray-200 rounded animate-pulse"></div>
                  </div>
                  <div className="space-y-3">
                    {[...Array(2)].map((_, j) => (
                      <div
                        key={j}
                        className="bg-white rounded-xl p-3 flex items-center gap-3 shadow-sm border border-gray-100"
                      >
                        <div className="w-12 h-12 bg-gray-200 rounded-lg animate-pulse"></div>
                        <div className="flex-1 space-y-2">
                          <div className="h-4 w-3/4 bg-gray-200 rounded animate-pulse"></div>
                          <div className="h-3 w-1/2 bg-gray-200 rounded animate-pulse"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-12 md:py-20 px-4 md:px-6">
            <div className="backdrop-blur-xl bg-white/30 rounded-2xl md:rounded-3xl p-8 md:p-12 border border-white/30 shadow-2xl flex flex-col items-center">
              {isIOS ? (
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-red-50 flex items-center justify-center mb-4 md:mb-6">
                  <AlertCircle className="w-9 h-9 md:w-11 md:h-11 text-red-400" />
                </div>
              ) : (
                <div className="text-5xl md:text-7xl mb-4 md:mb-6">😔</div>
              )}
              <div className="text-red-600 mb-3 md:mb-4 text-lg md:text-xl font-semibold">
                {error}
              </div>
              <button
                onClick={() => fetchDayAnalyses(selectedDate)}
                className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-6 md:px-8 py-3 md:py-4 rounded-xl md:rounded-2xl hover:from-emerald-600 hover:to-teal-700 transition-all duration-300 shadow-xl font-semibold backdrop-blur-sm border border-white/20"
              >
                Try Again
              </button>
            </div>
          </div>
        ) : (
          <>
            <OverviewPanels
              showTrendCard={showTrendCard}
              overviewSwipeHandlers={overviewSwipeHandlers}
              activeOverviewPanel={activeOverviewPanel}
              setActiveOverviewPanel={setActiveOverviewPanel}
              overviewPanelHeight={overviewPanelHeight}
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
              trendPanelRef={trendPanelRef}
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
              renderCaloriePointLabel={renderCaloriePointLabel}
            />
            {/* Meals */}
            <div className="px-4 md:px-6 space-y-4">
              <NutritionMealList
                analyses={analyses}
                displayedMeals={displayedMeals}
                hasMoreMeals={hasMoreMeals}
                loadingMore={loadingMore}
                sentinelRef={sentinelRef}
                undoState={undoState}
                setSelectedMeal={setSelectedMeal}
                handleOptimisticDelete={handleOptimisticDelete}
                isIOS={isIOS}
                user={user}
                setAnalyses={setAnalyses}
                setUndoState={setUndoState}
                applyDailyDelta={applyDailyDelta}
              />
            </div>
          </>
        )}
      </div>

      {/* Modal */}
      <MealAnalysisModal
        selectedMeal={selectedMeal}
        isClosingModal={isClosingModal}
        isEditing={isEditing}
        isSaving={isSaving}
        saveStatus={saveStatus}
        setSaveStatus={setSaveStatus}
        deletingId={deletingId}
        localDetailedItems={localDetailedItems}
        localNutrition={localNutrition}
        resetKey={resetKey}
        itemRefs={itemRefs}
        editingStates={editingStates}
        handleEditingChange={handleEditingChange}
        handleFoodUpdate={handleFoodUpdate}
        handleDeleteFoodItem={handleDeleteFoodItem}
        handleRestoreFoodItem={handleRestoreFoodItem}
        handleCloseModal={handleCloseModal}
        handleDeleteMeal={handleDeleteMeal}
        user={user}
      />
    </div>
  );
};

export default NutritionDashboard;
