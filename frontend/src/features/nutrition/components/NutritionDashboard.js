import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Calendar,
  AlertCircle,
} from "lucide-react";
import { Capacitor } from "@capacitor/core";
import "../../../LazyLoadStyles.css";
import { geminiService } from "../../../shared/services/geminiService";
import TouchFeedbackButton from "../../../shared/components/TouchFeedbackButton";
import {
  isMobileDevice,
  isSmallChartDevice,
  generateHorizontalCalendarDates,
  generateScrollableDates,
  resolveFoodItemIndex,
  transformDbItemToEditable,
} from "../services/nutritionDashboard";
import {
  NutritionSummaryCards,
  NutritionFilters,
  NutritionMealList,
  NutritionAnalysisPanel,
} from "./dashboard";

const UNDO_SECONDS = 5; // cooldown duration

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
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const isIOS = Capacitor.getPlatform() === "ios";
  // Use parent's selectedDate if provided, otherwise use local state
  const [localSelectedDate, setLocalSelectedDate] = useState(new Date());
  const selectedDate = propSelectedDate || localSelectedDate;
  const setSelectedDate = propSetSelectedDate || setLocalSelectedDate;
  const [dailyStats, setDailyStats] = useState({
    totalCalories: 0,
    totalProtein: 0,
    totalCarbs: 0,
    totalFat: 0,
    totalFiber: 0,
    mealCount: 0,
  });
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [selectedMeal, setSelectedMeal] = useState(null);
  const [isClosingModal, setIsClosingModal] = useState(false);

  // Editable food items state
  const [localDetailedItems, setLocalDetailedItems] = useState([]);
  const [localNutrition, setLocalNutrition] = useState({});
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // 'success' | 'error' | null
  const [editingStates, setEditingStates] = useState({});
  // eslint-disable-next-line no-unused-vars -- value unread; setter retained for re-render side effect
  const [editingIndex, setEditingIndex] = useState(null);
  const [resetKey] = useState(0);
  const itemRefs = useRef({});

  // delete button state
  const [deletingId, setDeletingId] = useState(null);

  // undo placeholders: key -> { originalMeal, expiresAt }
  const [undoState, setUndoState] = useState({});

  // Track when update is from auto-save to prevent UI reset
  const isAutoSaveUpdateRef = useRef(false);

  // Calorie target from user's BMR (fallback to 1500 if not set)
  const [calorieTarget, setCalorieTarget] = useState(1500);

  // Burned calories split by source: steps (from DB) + watch (from DB via education_logs_table)
  // const [stepsBurned, setStepsBurned] = useState(0);    // from daily_step_activity â€” STEP COUNTER DISABLED
  const stepsBurned = 0; // Step counter disabled
  const [dbWatchBurned, setDbWatchBurned] = useState(0); // from education_logs_table (today's watch entries)
  // Use the highest of: DB watch value OR the just-uploaded prop (in case DB hasn't been committed yet)
  const watchBurned = Math.max(dbWatchBurned, watchBurnedCalories);
  const burnedCalories = stepsBurned + watchBurned;      // combined total used in all calculations (steps disabled)
  // eslint-disable-next-line no-unused-vars -- value unread; setter retained for re-render side effect
  const [burnedLoading, setBurnedLoading] = useState(false);
  const watchUploadRef = useRef(null);

  const [trendRangeDays, setTrendRangeDays] = useState(7);
  const [calorieTrendData, setCalorieTrendData] = useState([]);
  const [trendLoading, setTrendLoading] = useState(false);
  const [showTrendCard, setShowTrendCard] = useState(false);
  const [activeOverviewPanel, setActiveOverviewPanel] = useState("summary");
  const [overviewPanelHeight, setOverviewPanelHeight] = useState(null);
  const overviewSwipeRef = useRef({
    active: false,
    startX: 0,
    lastX: 0,
  });
  const summaryPanelRef = useRef(null);
  const trendPanelRef = useRef(null);

  const resolveUserId = useCallback(async () => {
    // ðŸ”’ Demo account â€” return sentinel so dashboard renders empty instead of erroring
    const DEMO_ACCOUNTS = ['testereasywork@gmail.com'];
    if (DEMO_ACCOUNTS.includes((user?.email || '').toLowerCase().trim())) {
      return 'DEMO_USER';
    }
    if (user?.id) return user.id;
    if (!user?.email) return null;

    try {
      const lookupResponse = await fetch(`${apiBaseUrl}/api/user/lookup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email }),
      });
      const lookupData = await lookupResponse.json();
      if (lookupData.success && lookupData.userId) {
        return lookupData.userId;
      }
      return null;
    } catch (error) {
      console.error("[NutritionDashboard] Failed to resolve userId:", error);
      return null;
    }
  }, [user?.id, user?.email, apiBaseUrl]);

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
      const transformedItems = (foodData.detailedItems || []).map((item) =>
        transformDbItemToEditable(item),
      );
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
    [],
  );

  // Recalculate total nutrition from all food items
  const recalculateTotals = (items) => {
    const totals = items.reduce(
      (acc, item) => ({
        calories:
          acc.calories + (item.nutrition?.calories || item.calories || 0),
        protein: acc.protein + (item.nutrition?.protein || item.protein || 0),
        carbs: acc.carbs + (item.nutrition?.carbs || item.carbs || 0),
        fat: acc.fat + (item.nutrition?.fat || item.fat || 0),
        fiber: acc.fiber + (item.nutrition?.fiber || item.fiber || 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
    );

    return {
      calories: Math.round(totals.calories),
      protein: Math.round(totals.protein * 10) / 10,
      carbs: Math.round(totals.carbs * 10) / 10,
      fat: Math.round(totals.fat * 10) / 10,
      fiber: Math.round(totals.fiber * 10) / 10,
    };
  };

  // Handle food item update and save to database
  const persistMealItems = async (newItems, newTotals, options = {}) => {
    if (!selectedMeal?.ID) return;

    const {
      syncSelectedMeal = true,
      refreshStats = true,
    } = options;

    setIsSaving(true);
    try {
      const resolvedUserId = await resolveUserId();
      if (!resolvedUserId) {
        throw new Error("User not authenticated or not found in database");
      }

      const updatedAnalysisData = {
        foods: newItems.map((item) => ({
          name: item.name,
          portion:
            item.serving?.description ||
            item.portionDescription ||
            item.portion ||
            "1 serving",
          weight_g:
            item.unit === "ml"
              ? null
              : item.serving?.grams || item.grams || item.weight_g || 100,
          volume_ml:
            item.unit === "ml"
              ? item.serving?.grams || item.grams || item.weight_g || 100
              : null,
          unit: item.unit || item.serving?.unit || "g",
          isLiquid: item.isLiquid || item.serving?.isLiquid || false,
          nutrition: {
            calories: Math.round(item.nutrition?.calories || item.calories || 0),
            protein: Math.round(item.nutrition?.protein || item.protein || 0),
            carbs: Math.round(item.nutrition?.carbs || item.carbs || 0),
            fat: Math.round(item.nutrition?.fat || item.fat || 0),
            fiber: Math.round(item.nutrition?.fiber || item.fiber || 0),
          },
          originalAiName: item.originalAiName || item.name,
          wasAutoCorrected: item.wasAutoCorrected || false,
          correctionSource: item.correctionSource || null,
          correctionMetadata: item.correctionMetadata || null,
        })),
        total: {
          calories: Math.round(newTotals.calories || 0),
          protein: Math.round(newTotals.protein || 0),
          carbs: Math.round(newTotals.carbs || 0),
          fat: Math.round(newTotals.fat || 0),
          fiber: Math.round(newTotals.fiber || 0),
        },
        confidence: "high",
      };

      const response = await fetch(
        `${apiBaseUrl}/api/food-corrections/nutrition`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: selectedMeal.ID,
            userId: resolvedUserId,
            analysisData: updatedAnalysisData,
            totalCalories: Math.round(newTotals.calories || 0),
            totalProtein: Math.round(newTotals.protein || 0),
            totalCarbs: Math.round(newTotals.carbs || 0),
            totalFat: Math.round(newTotals.fat || 0),
            totalFiber: Math.round(newTotals.fiber || 0),
          }),
        },
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to update meal");
      }

      setAnalyses((prev) =>
        prev.map((meal) =>
          meal.ID === selectedMeal.ID
            ? {
                ...meal,
                AnalysisData: JSON.stringify(updatedAnalysisData),
                TotalCalories: Math.round(newTotals.calories || 0),
                TotalProtein: Math.round(newTotals.protein || 0),
                TotalCarbs: Math.round(newTotals.carbs || 0),
                TotalFat: Math.round(newTotals.fat || 0),
                TotalFiber: Math.round(newTotals.fiber || 0),
              }
            : meal,
        ),
      );

      if (syncSelectedMeal) {
        isAutoSaveUpdateRef.current = true;
        setSelectedMeal((prev) => ({
          ...prev,
          AnalysisData: JSON.stringify(updatedAnalysisData),
          TotalCalories: Math.round(newTotals.calories || 0),
          TotalProtein: Math.round(newTotals.protein || 0),
          TotalCarbs: Math.round(newTotals.carbs || 0),
          TotalFat: Math.round(newTotals.fat || 0),
          TotalFiber: Math.round(newTotals.fiber || 0),
        }));
      }

      if (refreshStats) {
        fetchDayAnalyses(selectedDate).catch((err) =>
          console.error("? Error reloading stats:", err),
        );
      }
    } catch (error) {
      console.error("[NutritionDashboard] Failed to persist meal items:", error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  const handleFoodUpdate = async (index, updatedFood) => {
    const newItems = [...localDetailedItems];
    newItems[index] = updatedFood;
    setLocalDetailedItems(newItems);

    const newTotals = recalculateTotals(newItems);
    setLocalNutrition(newTotals);

    try {
      await persistMealItems(newItems, newTotals);
    } catch (error) {
      console.error("? Error updating meal:", error);
      throw error;
    }
  };

  const handleDeleteFoodItem = async (index, options = {}) => {
    const phase = options?.phase || "finalize";
    const snapshot = options?.itemSnapshot || null;

    if (!Array.isArray(localDetailedItems) || localDetailedItems.length === 0)
      return;

    const targetIndex = resolveFoodItemIndex(localDetailedItems, index, snapshot);
    if (targetIndex === -1) return;

    const previousTotals = localNutrition;

    const newItems = localDetailedItems.filter((_, i) => i !== targetIndex);
    const newTotals = recalculateTotals(newItems);

    if (phase === "immediate") {
      // Persist deletion immediately in backend, keep row visible for undo UI.
      setLocalNutrition(newTotals);

      try {
        await persistMealItems(newItems, newTotals, {
          syncSelectedMeal: false,
          refreshStats: false,
        });
      } catch (error) {
        console.error("? Error deleting food item:", error);
        setLocalNutrition(previousTotals);
        throw error;
      }
      return;
    }

    // Finalize phase: remove row from local UI after undo timer ends.
    setLocalDetailedItems(newItems);
    setLocalNutrition(newTotals);
  };

  const handleRestoreFoodItem = async (index, snapshot) => {
    const previousItems = localDetailedItems;
    const previousTotals = localNutrition;

    let restoreItems = localDetailedItems;
    const existingIndex = resolveFoodItemIndex(localDetailedItems, index, snapshot);

    // If row was already removed in UI, reinsert before persisting restore.
    if (existingIndex === -1 && snapshot) {
      const insertAt = Math.max(0, Math.min(index, localDetailedItems.length));
      restoreItems = [
        ...localDetailedItems.slice(0, insertAt),
        snapshot,
        ...localDetailedItems.slice(insertAt),
      ];
      setLocalDetailedItems(restoreItems);
    }

    const restoreTotals = recalculateTotals(restoreItems);
    setLocalNutrition(restoreTotals);

    try {
      await persistMealItems(restoreItems, restoreTotals);
    } catch (error) {
      console.error("? Error restoring food item:", error);
      setLocalDetailedItems(previousItems);
      setLocalNutrition(previousTotals);
      throw error;
    }
  };

  // ? PAGINATION STATE
  const [displayedMeals, setDisplayedMeals] = useState([]);
  const [hasMoreMeals, setHasMoreMeals] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const MEALS_PER_PAGE = 10;
  const sentinelRef = useRef(null);

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

  const fetchDayAnalyses = useCallback(
    async (date) => {
      setLoading(true);
      setError(null);

      const calculateDailyStats = (dayAnalyses) => {
        const stats = dayAnalyses.reduce(
          (acc, analysis) => {
            if (analysis.isUndoPlaceholder) return acc;
            const foodData = parseAnalysisData(analysis.AnalysisData);
            const n = foodData.nutrition || {};
            const calories = n.calories || analysis.TotalCalories || 0;
            const protein = n.protein || analysis.TotalProtein || 0;
            const carbs = n.carbs || analysis.TotalCarbs || 0;
            const fat = n.fat || analysis.TotalFat || 0;
            const fiber = n.fiber || analysis.TotalFiber || 0;
            return {
              totalCalories: acc.totalCalories + calories,
              totalProtein: acc.totalProtein + protein,
              totalCarbs: acc.totalCarbs + carbs,
              totalFat: acc.totalFat + fat,
              totalFiber: acc.totalFiber + fiber,
              mealCount: acc.mealCount + 1,
            };
          },
          {
            totalCalories: 0,
            totalProtein: 0,
            totalCarbs: 0,
            totalFat: 0,
            totalFiber: 0,
            mealCount: 0,
          },
        );
        setDailyStats(stats);
      };

      try {
        const actualUserId = await resolveUserId();
        if (!actualUserId) {
          setError(
            "Unable to determine user account. Please try logging in again.",
          );
          return;
        }

        // âœ… TIMEZONE FIX: Use local date formatting instead of toISOString()
        // toISOString() converts to UTC which can shift the date for users in positive UTC offsets
        const dateString =
          date.getFullYear() +
          "-" +
          String(date.getMonth() + 1).padStart(2, "0") +
          "-" +
          String(date.getDate()).padStart(2, "0");
        // Add cache busting parameter to force fresh data
        const cacheBuster = Date.now();
        const response = await fetch(
          `${apiBaseUrl}/api/food-corrections/stats?userId=${actualUserId}&date=${dateString}&detailed=true&_t=${cacheBuster}`,
          {
            cache: "no-store", // Disable browser cache
            headers: {
              "Cache-Control": "no-cache",
              Pragma: "no-cache",
            },
          },
        );
        const data = await response.json();

        if (data.success) {
          let list = data.data || [];

          // ðŸ”’ Demo account â€” merge localStorage meals for the selected date
          if (actualUserId === 'DEMO_USER') {
            try {
              const demoMeals = JSON.parse(localStorage.getItem('demo_meals') || '[]');
              const dayMeals = demoMeals.filter(m => m.dateKey === dateString);
              list = [...list, ...dayMeals];
            } catch (e) { /* ignore */ }
          }

          setAnalyses(list);
          calculateDailyStats(list);
        } else {
          setError("Failed to load nutrition data");
        }
      } catch (err) {
        setError(
          "Failed to load nutrition data. Please check your connection.",
        );
      } finally {
        setLoading(false);
      }
    },
    [user, apiBaseUrl, resolveUserId],
  );

  useEffect(() => {
    if (user) fetchDayAnalyses(selectedDate);
  }, [user, selectedDate, fetchDayAnalyses]);

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

  // â”€â”€â”€ Fetch watch-burned calories from education_logs_table for the selected date â”€
  const fetchWatchBurnedCalories = useCallback(
    async (date) => {
      if (!user) return;
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
          `${apiBaseUrl}/api/activity/watch-calories?userId=${actualUserId}&date=${dateStr}&_t=${Date.now()}`,
        );
        const json = await res.json();
        if (json.success) {
          setDbWatchBurned(json.caloriesBurned || 0);
        }
      } catch (err) {
        console.warn("[NutritionDashboard] fetchWatchBurnedCalories failed:", err);
      }
    },
    [user, apiBaseUrl, resolveUserId],
  );

  useEffect(() => {
    if (user) fetchWatchBurnedCalories(selectedDate);
  }, [user, selectedDate, fetchWatchBurnedCalories, watchBurnedCalories]);
  // â†‘ also re-fetch when watchBurnedCalories changes (just saved a new watch image)

  // â”€â”€â”€ Smartwatch screenshot handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleWatchScreenshot = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      // Reset the input so the same file can be re-selected
      e.target.value = "";

      setBurnedLoading(true);
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
      } finally {
        setBurnedLoading(false);
      }
    },
    [],
  );

  const toLocalDateString = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const fetchCalorieTrend = useCallback(
    async (days) => {
      if (!user) return;

      setTrendLoading(true);

      try {
        const actualUserId = await resolveUserId();
        if (!actualUserId) {
          setCalorieTrendData([]);
          return;
        }

        const dates = [];
        for (let i = days - 1; i >= 0; i--) {
          const d = new Date(selectedDate);
          d.setDate(selectedDate.getDate() - i);
          dates.push(d);
        }

        const responses = await Promise.all(
          dates.map(async (d) => {
            const dateString = toLocalDateString(d);
            const cacheBuster = Date.now() + Math.random();
            const response = await fetch(
              `${apiBaseUrl}/api/food-corrections/stats?userId=${actualUserId}&date=${dateString}&detailed=true&_t=${cacheBuster}`,
              {
                cache: "no-store",
                headers: {
                  "Cache-Control": "no-cache",
                  Pragma: "no-cache",
                },
              },
            );

            const data = await response.json();
            const list = data?.success ? data.data || [] : [];
            const calories = list.reduce((sum, analysis) => {
              if (analysis.isUndoPlaceholder) return sum;
              const foodData = parseAnalysisData(analysis.AnalysisData);
              const n = foodData.nutrition || {};
              return sum + (n.calories || analysis.TotalCalories || 0);
            }, 0);

            return {
              key: dateString,
              date: d,
              label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
              calories: Math.round(calories),
              hasData: list.some((analysis) => !analysis.isUndoPlaceholder),
              target: calorieTarget,
            };
          }),
        );

        setCalorieTrendData(responses);
      } catch (err) {
        console.error("[NutritionDashboard] Failed to fetch calorie trend:", err);
        setCalorieTrendData([]);
      } finally {
        setTrendLoading(false);
      }
    },
    [user, resolveUserId, selectedDate, apiBaseUrl, calorieTarget],
  );

  useEffect(() => {
    if (!user) return;
    fetchCalorieTrend(trendRangeDays);
  }, [user, selectedDate, trendRangeDays, fetchCalorieTrend]);

  useEffect(() => {
    setShowTrendCard(false);
    const timer = setTimeout(() => setShowTrendCard(true), 40);
    return () => clearTimeout(timer);
  }, [calorieTrendData, trendRangeDays]);

  const handleOverviewPointerDown = (e) => {
    if (!e.isPrimary) return;
    overviewSwipeRef.current.active = true;
    overviewSwipeRef.current.startX = e.clientX;
    overviewSwipeRef.current.lastX = e.clientX;
  };

  const handleOverviewPointerMove = (e) => {
    if (!overviewSwipeRef.current.active || !e.isPrimary) return;
    overviewSwipeRef.current.lastX = e.clientX;
  };

  const handleOverviewPointerEnd = () => {
    const swipe = overviewSwipeRef.current;
    if (!swipe.active) return;
    swipe.active = false;

    const deltaX = swipe.lastX - swipe.startX;
    const threshold = 36;
    if (Math.abs(deltaX) < threshold) return;

    if (deltaX < 0) {
      setActiveOverviewPanel("trend");
    } else {
      setActiveOverviewPanel("summary");
    }
  };

  useEffect(() => {
    const updateOverviewHeight = () => {
      const activeRef =
        activeOverviewPanel === "summary" ? summaryPanelRef : trendPanelRef;
      if (activeRef.current) {
        setOverviewPanelHeight(activeRef.current.scrollHeight);
      }
    };

    // Wait one frame so content/layout is fully settled.
    const rafId = requestAnimationFrame(updateOverviewHeight);
    window.addEventListener("resize", updateOverviewHeight);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", updateOverviewHeight);
    };
  }, [activeOverviewPanel, trendLoading, calorieTrendData, trendRangeDays, dailyStats]);

  // Fetch user's BMR from profile for calorie target
  useEffect(() => {
    const fetchUserBmr = async () => {
      if (!user?.email) return;

      try {
        // Add timestamp to bust cache and get fresh data
        const response = await fetch(
          `${apiBaseUrl}/api/user/profile?email=${encodeURIComponent(
            user.email,
          )}&_t=${Date.now()}`,
        );
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data?.latestBmr) {
            // Use BMR from profile, fallback to 1500 if not available
            setCalorieTarget(Math.round(data.data.latestBmr));
            console.log(
              "ðŸ”¥ [NutritionDashboard] BMR loaded from profile:",
              data.data.latestBmr,
            );
          } else {
            console.log(
              "Ã¢Å¡Â Ã¯Â¸Â [NutritionDashboard] No BMR in profile, using default 1500",
            );
            setCalorieTarget(1500);
          }
        }
      } catch (err) {
        console.error("Ã¢ÂÅ’ [NutritionDashboard] Failed to fetch BMR:", err);
        // Keep default fallback of 1500
      }
    };

    fetchUserBmr();

    // Re-fetch BMR when user returns to the tab/app (e.g. after editing profile)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchUserBmr();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [user?.email, apiBaseUrl, bmrUpdateKey]);

  // âœ… UPDATE DISPLAYED MEALS WHEN ANALYSES CHANGE
  useEffect(() => {
    const initialMeals = analyses.slice(0, MEALS_PER_PAGE);
    setDisplayedMeals(initialMeals);
    setHasMoreMeals(analyses.length > MEALS_PER_PAGE);
  }, [analyses]);

  // âœ… INFINITE SCROLL: Load more meals when sentinel is visible
  useEffect(() => {
    if (!sentinelRef.current || !hasMoreMeals || loadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMoreMeals && !loadingMore) {
          setLoadingMore(true);

          setTimeout(() => {
            const currentLength = displayedMeals.length;
            const nextMeals = analyses.slice(0, currentLength + MEALS_PER_PAGE);
            setDisplayedMeals(nextMeals);
            setHasMoreMeals(nextMeals.length < analyses.length);
            setLoadingMore(false);
          }, 300);
        }
      },
      {
        root: null,
        rootMargin: "100px",
        threshold: 0.1,
      },
    );

    observer.observe(sentinelRef.current);

    return () => {
      if (observer) observer.disconnect();
    };
  }, [displayedMeals, analyses, hasMoreMeals, loadingMore]);

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

  // Wrapper for the modal delete button: optimistic delete with undo + rollback
  const handleDeleteMeal = async (meal) => {
    if (!meal?.ID) return;
    setDeletingId(meal.ID);

    const n = parseAnalysisData(meal.AnalysisData).nutrition || {};
    const deltas = {
      calories: -(n.calories || meal.TotalCalories || 0),
      protein: -(n.protein || meal.TotalProtein || 0),
      carbs: -(n.carbs || meal.TotalCarbs || 0),
      fat: -(n.fat || meal.TotalFat || 0),
      fiber: -(n.fiber || meal.TotalFiber || 0),
      mealCountDelta: -1,
    };

    const placeholder = {
      ID: `undo-${meal.ID}`,
      isUndoPlaceholder: true,
      CreatedAt: meal.CreatedAt,
    };

    setAnalyses((prev) => {
      const idx = prev.findIndex((m) => m.ID === meal.ID);
      if (idx === -1) {
        return prev.filter((m) => m.ID !== meal.ID).concat(placeholder);
      }
      const next = prev.slice();
      next.splice(idx, 1, placeholder);
      return next;
    });

    setUndoState((prev) => ({
      ...prev,
      [placeholder.ID]: {
        originalMeal: meal,
        expiresAt: Date.now() + UNDO_SECONDS * 1000,
        ttlSeconds: UNDO_SECONDS,
      },
    }));

    applyDailyDelta(deltas);
    setSelectedMeal(null);

    try {
      const res = await fetch(`${apiBaseUrl}/api/background-analysis`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: meal.ID, userId: user?.id }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Failed to delete.");
      if (onMealDelete) onMealDelete(meal.ID);
    } catch (err) {
      setAnalyses((prev) => {
        const idx = prev.findIndex((m) => m.ID === placeholder.ID);
        if (idx === -1) return prev;
        const next = prev.slice();
        next.splice(idx, 1, meal);
        return next;
      });
      setUndoState((prev) => {
        const next = { ...prev };
        delete next[placeholder.ID];
        return next;
      });
      applyDailyDelta({
        calories: -deltas.calories,
        protein: -deltas.protein,
        carbs: -deltas.carbs,
        fat: -deltas.fat,
        fiber: -deltas.fiber,
        mealCountDelta: -deltas.mealCountDelta,
      });
      setError(err.message || "Failed to delete. Please try again.");
      setTimeout(() => setError(null), 5000);
    } finally {
      setDeletingId(null);
    }
  };

  // Parent: pass this to <MealCard onDelete={...} />
  const handleOptimisticDelete = async (mealToDelete) => {
    const n = parseAnalysisData(mealToDelete.AnalysisData).nutrition || {};
    const deltas = {
      calories: -(n.calories || mealToDelete.TotalCalories || 0),
      protein: -(n.protein || mealToDelete.TotalProtein || 0),
      carbs: -(n.carbs || mealToDelete.TotalCarbs || 0),
      fat: -(n.fat || mealToDelete.TotalFat || 0),
      fiber: -(n.fiber || mealToDelete.TotalFiber || 0),
      mealCountDelta: -1,
    };

    const placeholder = {
      ID: `undo-${mealToDelete.ID}`,
      isUndoPlaceholder: true,
      CreatedAt: mealToDelete.CreatedAt,
    };

    // Replace in place (critical for no flicker / no â€œfloating deleteÃ¢â‚¬Â)
    setAnalyses((prev) => {
      const idx = prev.findIndex((m) => m.ID === mealToDelete.ID);
      if (idx === -1) return prev;
      const next = prev.slice();
      next.splice(idx, 1, placeholder);
      return next;
    });

    setUndoState((prev) => ({
      ...prev,
      [placeholder.ID]: {
        originalMeal: mealToDelete,
        expiresAt: Date.now() + UNDO_SECONDS * 1000,
        ttlSeconds: UNDO_SECONDS,
      },
    }));

    applyDailyDelta(deltas);

    try {
      const res = await fetch(`${apiBaseUrl}/api/background-analysis`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: mealToDelete.ID, userId: user?.id }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Delete failed");
      if (onMealDelete) onMealDelete(mealToDelete.ID);
    } catch (err) {
      // Rollback on failure
      setAnalyses((prev) => {
        const idx = prev.findIndex((m) => m.ID === placeholder.ID);
        if (idx === -1) return prev;
        const next = prev.slice();
        next.splice(idx, 1, mealToDelete);
        return next;
      });
      setUndoState((prev) => {
        const next = { ...prev };
        delete next[placeholder.ID];
        return next;
      });
      applyDailyDelta({
        calories: -deltas.calories,
        protein: -deltas.protein,
        carbs: -deltas.carbs,
        fat: -deltas.fat,
        fiber: -deltas.fiber,
        mealCountDelta: -deltas.mealCountDelta,
      });
      setError(err.message || "Failed to delete. Please try again.");
      setTimeout(() => setError(null), 5000); // Clear after 5 seconds
    }
  };

  const parseAnalysisData = (analysisData, moreTextColor = "text-gray-500") => {
    try {
      const parsed =
        typeof analysisData === "string"
          ? JSON.parse(analysisData)
          : analysisData;

      // Helper: user-friendly title from foods[]
      const formatFoodsTitle = (foods = []) => {
        const count = foods.length || 0;
        if (count === 0) return "Unknown Food";

        const first = (foods[0]?.name || "Unknown Food").trim();
        if (count === 1) return first;

        // For 2 items: "First & Second"
        if (count === 2) {
          const second = (foods[1]?.name || "another item").trim();
          return `${first} & ${second}`;
        }

        // For 3+ items: "First & other {count-1} item(s)"
        const others = count - 1;
        return (
          <>
            {first}{" "}
            <span className={`${moreTextColor} text-sm font-normal`}>
              + {others} more
            </span>
          </>
        );
      };

      // Unified format: foods[] + total
      if (parsed?.foods?.length > 0 && parsed?.total) {
        return {
          name: formatFoodsTitle(parsed.foods),
          nutrition: {
            calories: parsed.total.calories || 0,
            protein: parsed.total.protein || 0,
            carbs: parsed.total.carbs || 0,
            fat: parsed.total.fat || 0,
            fiber: parsed.total.fiber || 0,
          },
          detailedItems: parsed.foods || [],
        };
      }

      // Legacy manual: category + nutrition
      if (parsed?.category?.name) {
        return {
          name: parsed.category.name,
          nutrition: parsed.nutrition || {},
          detailedItems: parsed.detailedItems || [],
        };
      }

      // Legacy background: foods[] without total
      if (parsed?.foods?.length > 0) {
        const firstFood = parsed.foods[0] || {};
        return {
          name: formatFoodsTitle(parsed.foods),
          nutrition: firstFood.nutrition || {},
          detailedItems: parsed.foods || [],
        };
      }

      return { name: "Unknown Food", nutrition: {}, detailedItems: [] };
    } catch {
      return { name: "Error parsing data", nutrition: {}, detailedItems: [] };
    }
  };

  const applyDailyDelta = ({
    calories = 0,
    protein = 0,
    carbs = 0,
    fat = 0,
    fiber = 0,
    mealCountDelta = 0,
  }) => {
    setDailyStats((prev) => ({
      totalCalories: Math.max(0, prev.totalCalories + calories),
      totalProtein: Math.max(0, prev.totalProtein + protein),
      totalCarbs: Math.max(0, prev.totalCarbs + carbs),
      totalFat: Math.max(0, prev.totalFat + fat),
      totalFiber: Math.max(0, prev.totalFiber + fiber),
      mealCount: Math.max(0, prev.mealCount + mealCountDelta),
    }));
  };


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
              ? "up"
              : currentCalories < previousCalories
                ? "down"
                : "same";

        return {
          ...point,
          calories: currentCalories,
          previousCalories,
          changeDirection,
        };
      }),
    [calorieTrendData, calorieTarget],
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

  const renderCaloriePointLabel = useCallback(
    ({ x, y, index }) => {
      if (x === undefined || y === undefined || index === undefined) return null;
      if (!visibleNutritionDotIndices.has(index)) return null;

      const point = calorieChartRenderData[index];
      if (!point) return null;

      const text = point.hasData ? `${point.calories}` : "0";
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
        <>
          <div className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
            <div className="w-full max-w-md mx-auto md:max-w-2xl lg:max-w-4xl">
              <div className="flex items-center justify-between p-4 md:p-6">
                <TouchFeedbackButton
                  onClick={onBack}
                  className="p-2 md:p-3 hover:bg-gray-100 rounded-xl transition-colors"
                  ariaLabel="Go back"
                >
                  <ArrowLeft className="h-5 w-5 text-gray-700" />
                </TouchFeedbackButton>

                <div className="text-center">
                  <h1 className="text-lg md:text-xl font-semibold text-gray-900">
                    Nutrition
                  </h1>
                  <p className="text-sm text-gray-600">
                    {formatDateHeader(selectedDate)}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowCalendar(!showCalendar)}
                    className="p-2 md:p-3 hover:bg-gray-100 rounded-xl transition-colors"
                  >
                    <Calendar className="h-5 w-5 text-gray-700" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Date selector */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="w-full max-w-md mx-auto md:max-w-2xl lg:max-w-4xl">
          {isMobileDevice() ? (
            <div className="px-4 py-3">
              <div
                className="overflow-x-auto"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              >
                <style>{`
                  div::-webkit-scrollbar {
                    display: none;
                  }
                `}</style>
                <div
                  className="flex space-x-2 pb-1"
                  style={{ minWidth: "max-content" }}
                >
                  {generateScrollableDates(selectedDate).map((day, index) => (
                    <React.Fragment key={index}>
                      {day.isNewMonth && index > 0 && (
                        <div className="flex items-center justify-center mx-1 relative">
                          <div className="backdrop-blur-sm bg-white/30 rounded-lg px-1.5 py-1.5 shadow-sm border border-white/20">
                            <div
                              className="text-xs font-semibold text-gray-600"
                              style={{
                                writingMode: "vertical-rl",
                                textOrientation: "mixed",
                                fontSize: "9px",
                                letterSpacing: "1px",
                              }}
                            >
                              {day.monthName.toUpperCase()}
                            </div>
                          </div>
                        </div>
                      )}
                      <button
                        data-date-index={index}
                        onClick={() => setSelectedDate(day.date)}
                        className={`flex-shrink-0 w-12 text-center py-2 px-1 rounded-lg transition-all duration-300 relative backdrop-blur-sm border
                          ${
                            day.isSelected
                              ? "bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-lg scale-105 border-emerald-300"
                              : day.isToday
                              ? "bg-white/40 text-gray-800 border-white/30 shadow-md"
                              : "text-gray-600 hover:bg-white/30 bg-white/20 border-white/20"
                          }`}
                      >
                        <div className="text-xs font-medium mb-0.5">
                          {day.dayName}
                        </div>
                        <div className="text-sm font-semibold">
                          {day.dayNumber}
                        </div>
                        {day.isToday && (
                          <div
                            className={`w-1 h-1 rounded-full mx-auto mt-0.5 ${
                              day.isSelected ? "bg-white" : "bg-emerald-500"
                            }`}
                          />
                        )}
                      </button>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center px-4 py-3 md:px-6 md:py-2">
              <TouchFeedbackButton
                onClick={() => navigateDate(-1)}
                className="p-2 md:p-3 hover:bg-white/30 rounded-xl md:rounded-2xl transition-all duration-300 mr-2 md:mr-3 backdrop-blur-sm border border-white/20"
                ariaLabel="Previous day"
              >
                <ChevronLeft className="h-4 w-4 md:h-5 md:w-5 text-gray-600" />
              </TouchFeedbackButton>

              <div className="flex-1 overflow-hidden">
                <div className="flex items-center justify-center space-x-1 md:space-x-2">
                  {generateHorizontalCalendarDates(selectedDate).map((day, index) => (
                    <React.Fragment key={index}>
                      {day.isNewMonth && index > 0 && (
                        <div className="flex items-center justify-center mx-1 md:mx-2 relative h-full">
                          <div className="backdrop-blur-sm bg-white/30 rounded-lg md:rounded-xl px-1.5 md:px-2 py-2 md:py-3 shadow-sm border border-white/20">
                            <div
                              className="text-xs font-bold text-gray-600 tracking-wider"
                              style={{
                                writingMode: "vertical-rl",
                                textOrientation: "mixed",
                                letterSpacing: "2px",
                              }}
                            >
                              {day.monthName.toUpperCase()}
                            </div>
                          </div>
                        </div>
                      )}
                      <TouchFeedbackButton
                        onClick={() =>
                          !day.isFuture && setSelectedDate(day.date)
                        }
                        disabled={day.isFuture}
                        className={`w-12 h-12 md:w-16 md:h-16 text-center rounded-lg md:rounded-2xl transition-all duration-300 relative backdrop-blur-sm border
                          ${
                            day.isSelected
                              ? "bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-lg scale-105 border-emerald-300"
                              : day.isToday
                              ? "bg-white/40 text-gray-800 border-white/30 shadow-md"
                              : day.isFuture
                              ? "text-gray-300 cursor-not-allowed bg-white/10 border-white/10"
                              : "text-gray-600 hover:bg-white/30 bg-white/20 border-white/20"
                          }`}
                        ariaLabel={`${day.dayName} ${day.dayNumber}`}
                      >
                        <div className="text-xs font-medium mb-0.5 md:mb-1">
                          {day.dayName}
                        </div>
                        <div className="text-sm md:text-lg font-semibold">
                          {day.dayNumber}
                        </div>
                        {day.isToday && (
                          <div
                            className={`w-1 h-1 md:w-1.5 md:h-1.5 rounded-full mx-auto mt-0.5 md:mt-1 ${
                              day.isSelected ? "bg-white" : "bg-emerald-500"
                            }`}
                          />
                        )}
                      </TouchFeedbackButton>
                    </React.Fragment>
                  ))}
                </div>
              </div>

              <TouchFeedbackButton
                onClick={() => navigateDate(1)}
                disabled={(() => {
                  const nextDay = new Date(selectedDate);
                  nextDay.setDate(selectedDate.getDate() + 1);
                  return nextDay > new Date();
                })()}
                className="p-2 md:p-3 hover:bg-white/30 rounded-xl md:rounded-2xl transition-all duration-300 ml-2 md:ml-3 disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm border border-white/20"
                ariaLabel="Next day"
              >
                <ChevronRight className="h-4 w-4 md:h-5 md:w-5 text-gray-600" />
              </TouchFeedbackButton>
            </div>
          )}
        </div>
      </div>

      {/* Inline Calendar with Slide Animation */}
      <div
        className={`bg-white shadow-sm overflow-hidden transition-all duration-300 ease-in-out ${
          showCalendar ? "max-h-[32rem] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div
          className={`max-w-md mx-auto p-0 md:p-4 transform transition-transform duration-300 ease-in-out ${
            showCalendar ? "translate-y-0" : "-translate-y-4"
          }`}
        >
          <div className="bg-white rounded-2xl border-0 md:border md:border-grey-100">
            {/* Calendar Header */}
            <div className="flex items-center justify-between p-4 border-b border-grey-100">
              <TouchFeedbackButton
                onClick={() => {
                  const prevMonth = new Date(calendarMonth);
                  prevMonth.setMonth(prevMonth.getMonth() - 1);
                  setCalendarMonth(prevMonth);
                }}
                className="p-2 hover:bg-emerald-50 rounded-lg transition-colors"
                ariaLabel="Previous month"
              >
                <ChevronLeft className="w-5 h-5 text-grey-600" />
              </TouchFeedbackButton>

              <h3 className="text-lg font-semibold text-grey-900">
                {calendarMonth.toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                })}
              </h3>

              <TouchFeedbackButton
                onClick={() => {
                  const nextMonth = new Date(calendarMonth);
                  nextMonth.setMonth(nextMonth.getMonth() + 1);
                  setCalendarMonth(nextMonth);
                }}
                className="p-2 hover:bg-emerald-50 rounded-lg transition-colors"
                ariaLabel="Next month"
              >
                <ChevronRight className="w-5 h-5 text-grey-600" />
              </TouchFeedbackButton>
            </div>

            {/* Days of Week Headers */}
            <div className="grid grid-cols-7 gap-1 px-4 pt-4 pb-2">
              {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
                <div
                  key={index}
                  className="text-center text-sm font-semibold text-gray-500 py-2"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1 px-4 pb-4">
              {(() => {
                const year = calendarMonth.getFullYear();
                const month = calendarMonth.getMonth();
                const today = new Date();

                // Get first day of month and number of days
                const firstDay = new Date(year, month, 1);
                const lastDay = new Date(year, month + 1, 0);
                const daysInMonth = lastDay.getDate();
                const startingDayOfWeek = firstDay.getDay(); // 0 = Sunday

                const days = [];

                // Add empty cells for days before the month starts
                for (let i = 0; i < startingDayOfWeek; i++) {
                  const prevDate = new Date(
                    year,
                    month,
                    -startingDayOfWeek + i + 1,
                  );
                  days.push({
                    date: prevDate,
                    dayNumber: prevDate.getDate(),
                    isCurrentMonth: false,
                    isToday: prevDate.toDateString() === today.toDateString(),
                    isSelected:
                      prevDate.toDateString() === selectedDate.toDateString(),
                    isFuture: prevDate > today,
                  });
                }

                // Add days of current month
                for (let day = 1; day <= daysInMonth; day++) {
                  const date = new Date(year, month, day);
                  days.push({
                    date: date,
                    dayNumber: day,
                    isCurrentMonth: true,
                    isToday: date.toDateString() === today.toDateString(),
                    isSelected:
                      date.toDateString() === selectedDate.toDateString(),
                    isFuture: date > today,
                  });
                }

                // Add days from next month to fill the grid
                const remainingCells = 42 - days.length; // 6 rows Ã— 7 days
                for (let day = 1; day <= remainingCells; day++) {
                  const nextDate = new Date(year, month + 1, day);
                  days.push({
                    date: nextDate,
                    dayNumber: day,
                    isCurrentMonth: false,
                    isToday: nextDate.toDateString() === today.toDateString(),
                    isSelected:
                      nextDate.toDateString() === selectedDate.toDateString(),
                    isFuture: nextDate > today,
                  });
                }

                return days.map((day, index) => {
                  const isDisabled = day.isFuture;

                  return (
                    <TouchFeedbackButton
                      key={index}
                      onClick={() => {
                        if (!isDisabled) {
                          setSelectedDate(day.date);
                          setShowCalendar(false);
                        }
                      }}
                      disabled={isDisabled}
                      className={`
                        aspect-square p-2 text-sm font-medium rounded-lg transition-all duration-200 relative
                        ${
                          day.isSelected
                            ? "bg-emerald-500 text-white shadow-lg transform scale-105"
                            : day.isToday && !day.isSelected
                            ? "bg-emerald-100 text-emerald-700 border-2 border-emerald-300 font-bold"
                            : day.isCurrentMonth
                            ? isDisabled
                              ? "text-gray-400 cursor-not-allowed opacity-50"
                              : "text-gray-700 hover:bg-emerald-50 hover:scale-105"
                            : isDisabled
                            ? "text-gray-300 cursor-not-allowed opacity-30"
                            : "text-gray-400 hover:bg-emerald-50 hover:scale-105"
                        }
                      `}
                    >
                      {day.dayNumber}

                      {/* Today indicator dot */}
                      {day.isToday && !day.isSelected && (
                        <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      )}
                    </TouchFeedbackButton>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      </div>

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
          /* error state ... (unchanged) */
          <div className="text-center py-12 md:py-20 px-4 md:px-6">
            <div className="backdrop-blur-xl bg-white/30 rounded-2xl md:rounded-3xl p-8 md:p-12 border border-white/30 shadow-2xl flex flex-col items-center">
              {isIOS ? (
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-red-50 flex items-center justify-center mb-4 md:mb-6">
                  <AlertCircle className="w-9 h-9 md:w-11 md:h-11 text-red-400" />
                </div>
              ) : (
                <div className="text-5xl md:text-7xl mb-4 md:mb-6">ðŸ˜”</div>
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
            <div className="px-3 md:px-4 mt-3 md:mt-5 mb-4">
              <div
                className={`w-full max-w-md mx-auto bg-white/70 backdrop-blur-xl rounded-2xl shadow-md border border-gray-100 overflow-hidden transition-all duration-500 ease-out ${
                  showTrendCard ? "opacity-100 translate-x-0" : "opacity-0 translate-x-6"
                }`}
                onPointerDown={handleOverviewPointerDown}
                onPointerMove={handleOverviewPointerMove}
                onPointerUp={handleOverviewPointerEnd}
                onPointerCancel={handleOverviewPointerEnd}
                onPointerLeave={handleOverviewPointerEnd}
              >
                <div className="px-4 md:px-5 pt-4 md:pt-5 pb-2 flex items-center justify-between">
                  <div className="text-xs md:text-sm text-gray-500">
                    {activeOverviewPanel === "summary"
                      ? "Daily Summary"
                      : `Calorie Trend (${trendRangeDays}D)`}
                  </div>
                  <div className="flex items-center gap-1 bg-gray-100 rounded-full p-1">
                    <button
                      type="button"
                      onClick={() => setActiveOverviewPanel("summary")}
                      className={`px-2.5 py-1 text-[11px] md:text-xs rounded-full transition-all duration-300 ${
                        activeOverviewPanel === "summary"
                          ? "bg-emerald-500 text-white shadow-sm"
                          : "text-gray-600 hover:bg-white"
                      }`}
                    >
                      Summary
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveOverviewPanel("trend")}
                      className={`px-2.5 py-1 text-[11px] md:text-xs rounded-full transition-all duration-300 ${
                        activeOverviewPanel === "trend"
                          ? "bg-emerald-500 text-white shadow-sm"
                          : "text-gray-600 hover:bg-white"
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
                        activeOverviewPanel === "summary"
                          ? "translateX(0%)"
                          : "translateX(-50%)",
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
                    onClick={() => setActiveOverviewPanel("summary")}
                    style={{ width: 7, height: 7, minWidth: 0, minHeight: 0, padding: 0 }}
                    className={`rounded-full transition-all duration-300 ${
                      activeOverviewPanel === "summary"
                        ? "bg-emerald-500"
                        : "bg-gray-300 hover:bg-gray-400"
                    }`}
                  />
                  <button
                    type="button"
                    aria-label="Go to trend slide"
                    onClick={() => setActiveOverviewPanel("trend")}
                    style={{ width: 7, height: 7, minWidth: 0, minHeight: 0, padding: 0 }}
                    className={`rounded-full transition-all duration-300 ${
                      activeOverviewPanel === "trend"
                        ? "bg-emerald-500"
                        : "bg-gray-300 hover:bg-gray-400"
                    }`}
                  />
                </div>
              </div>
            </div>
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
      <NutritionAnalysisPanel
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

