import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  ArrowLeft,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Leaf,
  Beef,
  Wheat,
  Droplet,
  RotateCcw,
  Bug,
} from "lucide-react";
import "../LazyLoadStyles.css";
import EditableFoodItem from "./EditableFoodItem";
import TouchFeedbackButton from "./TouchFeedbackButton";
import { geminiService } from "../services/geminiService";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  LabelList,
  ResponsiveContainer,
} from "recharts";

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
  const [editingIndex, setEditingIndex] = useState(null);
  const [resetKey, setResetKey] = useState(0);
  const itemRefs = useRef({});

  // delete button state
  const [deletingId, setDeletingId] = useState(null);

  // undo placeholders: key -> { originalMeal, expiresAt }
  const [undoState, setUndoState] = useState({});
  const [undoing, setUndoing] = useState(false);

  // Track when update is from auto-save to prevent UI reset
  const isAutoSaveUpdateRef = useRef(false);

  // Calorie target from user's BMR (fallback to 1500 if not set)
  const [calorieTarget, setCalorieTarget] = useState(1500);

  // Burned calories split by source: steps (from DB) + watch (from DB via education_logs_table)
  const [stepsBurned, setStepsBurned] = useState(0);    // from daily_step_activity
  const [dbWatchBurned, setDbWatchBurned] = useState(0); // from education_logs_table (today's watch entries)
  // Use the highest of: DB watch value OR the just-uploaded prop (in case DB hasn't been committed yet)
  const watchBurned = Math.max(dbWatchBurned, watchBurnedCalories);
  const burnedCalories = stepsBurned + watchBurned;      // combined total used in all calculations
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
    if (user?.id) return user.id;
    if (!user?.email) return null;

    try {
      const lookupResponse = await fetch(`${apiBaseUrl}/api/lookup-user-id`, {
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

      // 🔍 DEBUG: Log what we're loading from database
      console.log("🔍 [NutritionDashboard] Loading from database:", {
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
        // Auto-detect liquids from name if not explicitly set (for backwards compatibility)
        const nameToCheck = (item.name || "").toLowerCase();
        const liquidKeywords = [
          "shake",
          "juice",
          "milk",
          "Lassi",
          "coffee",
          "tea",
          "water",
          "smoothie",
          "soup",
          "drink",
          "beverage",
          "cola",
          "soda",
          "beer",
          "wine",
          "cocktail",
          "latte",
          "cappuccino",
          "espresso",
        ];
        const isLiquidByName = liquidKeywords.some((keyword) =>
          nameToCheck.includes(keyword),
        );

        // Determine if this is a liquid food - check both explicit flag and volume_ml presence
        const isLiquid =
          item.isLiquid === true ||
          (item.volume_ml !== null && item.volume_ml !== undefined) ||
          isLiquidByName;

        // ✅ Get the correct value based on liquid/solid
        const actualGrams = isLiquid
          ? item.volume_ml || item.grams || item.weight_g || 100
          : item.weight_g || item.grams || item.volume_ml || 100;

        const unit = item.unit || (isLiquid ? "ml" : "g");

        // Calculate per100g if not present (needed for editing)
        const nutrition = item.nutrition || {};
        const per100g = item.per100g || {
          calories: (nutrition.calories || 0) * (100 / actualGrams),
          protein: (nutrition.protein || 0) * (100 / actualGrams),
          carbs: (nutrition.carbs || 0) * (100 / actualGrams),
          fat: (nutrition.fat || 0) * (100 / actualGrams),
          fiber: (nutrition.fiber || 0) * (100 / actualGrams),
        };

        const transformed = {
          ...item,
          serving: {
            description: item.portion,
            grams: actualGrams,
            unit: unit,
            isLiquid: isLiquid,
          },
          portionDescription: item.portion,
          grams: actualGrams,
          unit: unit,
          isLiquid: isLiquid,
          per100g: per100g, // ✅ Add per100g for editing calculations
          // 🔴 CRITICAL: Preserve correction metadata if it exists
          // If originalAiName doesn't exist, mark it so EditableFoodItem will reverse-lookup
          originalAiName: item.originalAiName || null, // Use null instead of fallback
          wasAutoCorrected:
            item.wasAutoCorrected || (item.originalAiName ? true : false),
          correctionSource: item.correctionSource || null,
          correctionMetadata: item.correctionMetadata || null,
          // Flag to indicate this item needs reverse-lookup
          needsReverseLookup: !item.originalAiName && !item.correctionMetadata,
        };
        console.log("🔍 [NutritionDashboard] Transformed item:", {
          name: item.name,
          originalAiName: transformed.originalAiName,
          wasAutoCorrected: transformed.wasAutoCorrected,
          needsReverseLookup: transformed.needsReverseLookup,
          correctionMetadataAiDetected: item.correctionMetadata?.aiDetected,
          isLiquidByName,
          original: item,
          transformed: transformed,
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
    [],
  );

  // Handle closing edit mode (save changes first)
  const handleCloseEditing = useCallback(async () => {
    // Save all editing items before closing
    setIsSaving(true);

    try {
      // Get all item refs and call save() on editing items
      const savePromises = Object.keys(itemRefs.current).map((index) => {
        const itemRef = itemRefs.current[index];
        // Check if this item is currently editing
        if (itemRef && editingStates[index] && itemRef.save) {
          console.log(`💾 Saving item ${index} before closing...`);
          return itemRef.save();
        }
        return Promise.resolve();
      });

      // Wait for all saves to complete
      await Promise.all(savePromises);
      console.log("✅ All items saved successfully");
    } catch (error) {
      console.error("❌ Error saving items:", error);
      // Continue to close even if save fails - items already handle errors
    } finally {
      setIsSaving(false);
    }

    // Exit edit mode
    setIsEditing(false);
    setEditingStates({});
    setEditingIndex(null);
  }, [editingStates]);

  // Handle cancel editing (discard changes)
  const handleCancelEditing = useCallback(() => {
    // Reset to original data
    const foodData = parseAnalysisData(selectedMeal.AnalysisData);
    const transformedItems = (foodData.detailedItems || []).map((item) => {
      // Auto-detect liquids from name if not explicitly set (for backwards compatibility)
      const nameToCheck = (item.name || "").toLowerCase();
      const liquidKeywords = [
        "shake",
        "juice",
        "milk",
        "coffee",
        "tea",
        "water",
        "smoothie",
        "soup",
        "drink",
        "beverage",
        "cola",
        "soda",
        "beer",
        "wine",
        "cocktail",
        "latte",
        "cappuccino",
        "espresso",
      ];
      const isLiquidByName = liquidKeywords.some((keyword) =>
        nameToCheck.includes(keyword),
      );

      // Determine if this is a liquid food
      const isLiquid =
        item.isLiquid === true ||
        (item.volume_ml !== null && item.volume_ml !== undefined) ||
        isLiquidByName;

      // ✅ Get the correct value based on liquid/solid
      const actualGrams = isLiquid
        ? item.volume_ml || item.grams || item.weight_g || 100
        : item.weight_g || item.grams || item.volume_ml || 100;

      const unit = item.unit || (isLiquid ? "ml" : "g");

      return {
        ...item,
        serving: {
          description: item.portion,
          grams: actualGrams,
          unit: unit,
          isLiquid: isLiquid,
        },
        portionDescription: item.portion,
        grams: actualGrams,
        unit: unit,
        isLiquid: isLiquid,
        // 🔴 CRITICAL: Preserve correction metadata if it exists
        originalAiName: item.originalAiName || null, // Use null instead of fallback
        wasAutoCorrected:
          item.wasAutoCorrected || (item.originalAiName ? true : false),
        correctionSource: item.correctionSource || null,
        correctionMetadata: item.correctionMetadata || null,
        // Flag to indicate this item needs reverse-lookup
        needsReverseLookup: !item.originalAiName && !item.correctionMetadata,
      };
    });
    setLocalDetailedItems(transformedItems);
    setLocalNutrition(foodData.nutrition || {});
    setIsEditing(false);
    setEditingStates({});
    setEditingIndex(null);
    // Force remount of EditableFoodItem components
    setResetKey((prev) => prev + 1);
  }, [selectedMeal]);

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
        `${apiBaseUrl}/api/update-nutrition-analysis`,
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

  const getFoodSignature = (item) => {
    const name = (item?.name || "").trim().toLowerCase();
    const grams =
      item?.serving?.grams ?? item?.grams ?? item?.estimatedWeight ?? "";
    const unit =
      (item?.serving?.unit || item?.unit || "").trim().toLowerCase();
    return `${name}::${grams}::${unit}`;
  };

  const resolveFoodItemIndex = (items, fallbackIndex, snapshot) => {
    if (snapshot) {
      const snapSig = getFoodSignature(snapshot);
      const bySignature = items.findIndex(
        (item) => getFoodSignature(item) === snapSig,
      );
      if (bySignature !== -1) return bySignature;
    }

    if (fallbackIndex >= 0 && fallbackIndex < items.length) {
      return fallbackIndex;
    }

    return -1;
  };

  const handleDeleteFoodItem = async (index, options = {}) => {
    const phase = options?.phase || "finalize";
    const snapshot = options?.itemSnapshot || null;

    if (!Array.isArray(localDetailedItems) || localDetailedItems.length === 0)
      return;

    const targetIndex = resolveFoodItemIndex(localDetailedItems, index, snapshot);
    if (targetIndex === -1) return;

    const previousItems = localDetailedItems;
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

  /* ---------------- Helpers ---------------- */

  const istToLocalDate = (value) => {
    if (!value) return new Date(NaN);
    if (value instanceof Date) return new Date(value.getTime());

    if (typeof value === "string") {
      // API timestamps can include trailing Z; strip it when we need local-day behavior.
      const normalized = value.endsWith("Z") ? value.slice(0, -1) : value;
      const localDate = new Date(normalized);
      if (!Number.isNaN(localDate.getTime())) return localDate;
    }

    return new Date(value);
  };

  const getMealCategory = (timeString) => {
    const hour = istToLocalDate(timeString).getHours();
    if (hour >= 5 && hour < 10) return "breakfast";
    if (hour >= 10 && hour < 12) return "morning-snack";
    if (hour >= 12 && hour < 16) return "lunch";
    if (hour >= 16 && hour < 18) return "evening-snack";
    if (hour >= 18 && hour < 23) return "dinner";
    return "late-night";
  };

  const formatTimeAMPM = (hour, minute = 0) => {
    const d = new Date();
    d.setHours(hour);
    d.setMinutes(minute);
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const getMealCategoryInfo = (category) => {
    const categories = {
      breakfast: {
        name: "Breakfast",
        timeRange: { start: { h: 5, m: 0 }, end: { h: 10, m: 0 } },
      },
      "morning-snack": {
        name: "Morning Snack",
        timeRange: { start: { h: 10, m: 0 }, end: { h: 12, m: 0 } },
      },
      lunch: {
        name: "Lunch",
        timeRange: { start: { h: 12, m: 0 }, end: { h: 16, m: 0 } },
      },
      "evening-snack": {
        name: "Evening Snack",
        timeRange: { start: { h: 16, m: 0 }, end: { h: 18, m: 0 } },
      },
      dinner: {
        name: "Dinner",
        timeRange: { start: { h: 18, m: 0 }, end: { h: 23, m: 0 } },
      },
      "late-night": {
        name: "Late Night",
        timeRange: { start: { h: 23, m: 0 }, end: { h: 5, m: 0 } },
      },
    };
    return categories[category] || categories["late-night"];
  };

  const formatTimeRangeAMPM = (range) =>
    range
      ? `${formatTimeAMPM(range.start.h, range.start.m)} - ${formatTimeAMPM(
          range.end.h,
          range.end.m,
        )}`
      : "";

  const isMobileDevice = () =>
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent,
    ) || window.innerWidth <= 768;

  const generateHorizontalCalendarDates = () => {
    const dates = [];
    const today = new Date();
    for (let i = -3; i <= 3; i++) {
      const date = new Date(selectedDate);
      date.setDate(selectedDate.getDate() + i);
      const prevDate = i > -3 ? new Date(selectedDate) : null;
      if (prevDate) prevDate.setDate(selectedDate.getDate() + (i - 1));
      const isNewMonth =
        i === -3 || (prevDate && date.getMonth() !== prevDate.getMonth());
      dates.push({
        date,
        dayName: date.toLocaleDateString("en-US", { weekday: "short" }),
        dayNumber: date.getDate(),
        monthName: date.toLocaleDateString("en-US", { month: "short" }),
        isToday: date.toDateString() === today.toDateString(),
        isSelected: date.toDateString() === selectedDate.toDateString(),
        isFuture: date > today,
        isNewMonth,
      });
    }
    return dates;
  };

  const generateScrollableDates = () => {
    const dates = [];
    const today = new Date();
    for (let i = -20; i <= 0; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const prevDate = i > -20 ? new Date(today) : null;
      if (prevDate) prevDate.setDate(today.getDate() + (i - 1));
      const isNewMonth =
        i === -20 || (prevDate && date.getMonth() !== prevDate.getMonth());
      dates.push({
        date,
        dayName: date.toLocaleDateString("en-US", { weekday: "short" }),
        dayNumber: date.getDate(),
        monthName: date.toLocaleDateString("en-US", { month: "short" }),
        isToday: date.toDateString() === today.toDateString(),
        isSelected: date.toDateString() === selectedDate.toDateString(),
        isFuture: false,
        isNewMonth,
      });
    }
    return dates;
  };

  useEffect(() => {
    if (isMobileDevice()) {
      setTimeout(() => {
        const scrollableDates = generateScrollableDates();
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
        let actualUserId = user.id;
        if (!actualUserId && user.uid) {
          try {
            const lookupResponse = await fetch(
              `${apiBaseUrl}/api/lookup-user-id`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: user.email }),
              },
            );
            const lookupData = await lookupResponse.json();
            if (lookupData.success && lookupData.userId)
              actualUserId = lookupData.userId;
            else {
              setError(
                "User account not found in database. Please contact support.",
              );
              return;
            }
          } catch {
            setError("Failed to lookup user account. Please try again.");
            return;
          }
        }
        if (!actualUserId) {
          setError(
            "Unable to determine user account. Please try logging in again.",
          );
          return;
        }

        // ✅ TIMEZONE FIX: Use local date formatting instead of toISOString()
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
          `${apiBaseUrl}/api/user-nutrition-stats?userId=${actualUserId}&date=${dateString}&detailed=true&_t=${cacheBuster}`,
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
          const list = data.data || [];
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
    [user, apiBaseUrl],
  );

  useEffect(() => {
    if (user) fetchDayAnalyses(selectedDate);
  }, [user, selectedDate, fetchDayAnalyses]);

  // ─── Fetch burned calories from daily_step_activity for the selected date ────
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
          `${apiBaseUrl}/api/get-daily-activity?userId=${actualUserId}&date=${dateStr}&activityType=walking&_t=${Date.now()}`,
          { cache: "no-store", headers: { "Cache-Control": "no-cache", Pragma: "no-cache" } },
        );
        const json = await res.json();
        // API returns { trend/data: [...] } — find the entry matching today's date
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

  // ─── Fetch watch-burned calories from education_logs_table for the selected date ─
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
          `${apiBaseUrl}/api/get-watch-burned-calories?userId=${actualUserId}&date=${dateStr}&_t=${Date.now()}`,
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
  // ↑ also re-fetch when watchBurnedCalories changes (just saved a new watch image)

  // ─── Smartwatch screenshot handler ───────────────────────────────────────
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
          // This legacy handler is no longer used — upload happens on main page via WatchActivityCard.
          console.log(
            `[BurnToBalance] 📷 Extracted ${result.caloriesBurned} kcal burned from ${result.source} (confidence: ${result.confidence})`,
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
              `${apiBaseUrl}/api/user-nutrition-stats?userId=${actualUserId}&date=${dateString}&detailed=true&_t=${cacheBuster}`,
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
          `${apiBaseUrl}/api/get-user-profile?email=${encodeURIComponent(
            user.email,
          )}&_t=${Date.now()}`,
        );
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data?.latestBmr) {
            // Use BMR from profile, fallback to 1500 if not available
            setCalorieTarget(Math.round(data.data.latestBmr));
            console.log(
              "🔥 [NutritionDashboard] BMR loaded from profile:",
              data.data.latestBmr,
            );
          } else {
            console.log(
              "⚠️ [NutritionDashboard] No BMR in profile, using default 1500",
            );
            setCalorieTarget(1500);
          }
        }
      } catch (err) {
        console.error("❌ [NutritionDashboard] Failed to fetch BMR:", err);
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

  // ✅ UPDATE DISPLAYED MEALS WHEN ANALYSES CHANGE
  useEffect(() => {
    const initialMeals = analyses.slice(0, MEALS_PER_PAGE);
    setDisplayedMeals(initialMeals);
    setHasMoreMeals(analyses.length > MEALS_PER_PAGE);
  }, [analyses]);

  // ✅ INFINITE SCROLL: Load more meals when sentinel is visible
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

    // Replace in place (critical for no flicker / no “floating delete”)
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
      const res = await fetch(`${apiBaseUrl}/api/delete-background-analysis`, {
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

  const UndoRow = ({
    pid,
    originalMeal,
    expiresAt,
    ttlSeconds = UNDO_SECONDS,
  }) => {
    const [now, setNow] = useState(Date.now());
    const [undoing, setUndoing] = useState(false);

    // 1) Text refresh only (does not affect bar animation)
    useEffect(() => {
      const iv = setInterval(() => setNow(Date.now()), 250);
      return () => clearInterval(iv);
    }, []);

    // 2) Freeze animation config at mount (stable across re-renders)
    const { total, delayAtMount } = React.useMemo(() => {
      const total = Math.max(0, ttlSeconds);
      const startedAt = expiresAt - total * 1000;
      const elapsedAtMount = Math.min(
        total,
        Math.max(0, (Date.now() - startedAt) / 1000),
      );
      return { total, delayAtMount: -elapsedAtMount }; // negative delay
    }, [expiresAt, ttlSeconds]);

    // 3) Expire precisely at expiresAt, independent of CSS
    useEffect(() => {
      const msLeft = Math.max(0, expiresAt - Date.now());
      const t = setTimeout(() => {
        // remove placeholder + state
        setAnalyses((prev) => prev.filter((a) => a.ID !== pid));
        setUndoState((prev) => {
          const next = { ...prev };
          delete next[pid];
          return next;
        });
      }, msLeft);
      return () => clearTimeout(t);
    }, [expiresAt, pid]);

    const foodName =
      parseAnalysisData(originalMeal.AnalysisData).name || "Food";
    const remainingSecs = Math.ceil(Math.max(0, expiresAt - now) / 1000);

    return (
      <div className="relative bg-white border border-amber-200/70 rounded-xl p-3 flex items-center gap-3 shadow-sm">
        <div className="h-7 w-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
            <circle cx="12" cy="12" r="3" />
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-800 truncate">
            <span className="font-medium">Removed</span> “{foodName}”
          </p>
          <p className="text-[11px] text-amber-700/80">
            Undo available for {remainingSecs}s
          </p>
        </div>

        {/* --- Undo button (unchanged from your latest) --- */}
        <button
          disabled={undoing}
          onClick={async () => {
            if (undoing) return;
            const entry = undoState[pid];
            const orig = entry?.originalMeal;
            if (!orig) return;

            setUndoing(true);

            // Optimistic restore
            setAnalyses((prev) =>
              prev.filter((a) => a.ID !== pid).concat(orig),
            );
            const n = parseAnalysisData(orig.AnalysisData).nutrition || {};
            applyDailyDelta({
              calories: +(n.calories || orig.TotalCalories || 0),
              protein: +(n.protein || orig.TotalProtein || 0),
              carbs: +(n.carbs || orig.TotalCarbs || 0),
              fat: +(n.fat || orig.TotalFat || 0),
              fiber: +(n.fiber || orig.TotalFiber || 0),
              mealCountDelta: +1,
            });
            setUndoState((prev) => {
              const nxt = { ...prev };
              delete nxt[pid];
              return nxt;
            });

            try {
              // NOTE: make sure this path matches your backend filename.
              const resp = await fetch(
                `${apiBaseUrl}/api/undo-deleted-analysis`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ id: orig.ID, userId: user?.id }),
                },
              );
              const data = await resp.json();
              if (!data.success) throw new Error(data.message || "Undo failed");
            } catch (err) {
              // Revert optimistic
              setAnalyses((prev) =>
                prev
                  .filter((a) => a.ID !== orig.ID)
                  .concat({
                    ID: pid,
                    isUndoPlaceholder: true,
                    CreatedAt: orig.CreatedAt,
                  }),
              );
              applyDailyDelta({
                calories: -(n.calories || orig.TotalCalories || 0),
                protein: -(n.protein || orig.TotalProtein || 0),
                carbs: -(n.carbs || orig.TotalCarbs || 0),
                fat: -(n.fat || orig.TotalFat || 0),
                fiber: -(n.fiber || orig.TotalFiber || 0),
                mealCountDelta: -1,
              });
              // Restore undo state with the same expiry (keeps bar in sync)
              setUndoState((prev) => ({
                ...prev,
                [pid]: { originalMeal: orig, expiresAt, ttlSeconds },
              }));
            } finally {
              setUndoing(false);
            }
          }}
          className={`inline-flex items-center gap-1.5 rounded-full border border-amber-300 px-3 py-1.5 text-sm font-medium
          ${
            undoing
              ? "text-amber-500 bg-amber-50 cursor-not-allowed"
              : "text-amber-800 hover:bg-amber-100/60 active:scale-95 transition"
          }`}
        >
          {undoing ? (
            <>
              <span className="inline-block h-4 w-4 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
              Restoring…
            </>
          ) : (
            <>
              <RotateCcw className="w-4 h-4" />
              Undo
            </>
          )}
        </button>

        {/* Smooth cooldown bar (stable; no re-starting on re-renders) */}
        <span className="absolute left-0 right-0 bottom-0 h-0.5 bg-amber-200/70 overflow-hidden rounded-b-xl">
          <span
            key={pid} /* ensure a fresh mount per placeholder */
            className="block h-full bg-amber-600 origin-left will-change-transform"
            style={{
              transformOrigin: "left",
              animation: `countdown-shrink ${total}s linear ${delayAtMount}s forwards`,
            }}
          />
        </span>
      </div>
    );
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

  // ─── Burn-to-Balance derived values ──────────────────────────────────────
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

  const xAxisInterval =
    trendRangeDays <= 7 ? 0 : trendRangeDays <= 14 ? 1 : trendRangeDays <= 21 ? 2 : 4;

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
      return (
        <text
          x={x}
          y={y - 11}
          textAnchor="middle"
          fill="#9ca3af"
          fontSize={9}
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
                  {generateScrollableDates().map((day, index) => (
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
                  {generateHorizontalCalendarDates().map((day, index) => (
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
                const remainingCells = 42 - days.length; // 6 rows × 7 days
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
            <div className="backdrop-blur-xl bg-white/30 rounded-2xl md:rounded-3xl p-8 md:p-12 border border-white/30 shadow-2xl">
              <div className="text-5xl md:text-7xl mb-4 md:mb-6">😔</div>
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
                    <div ref={summaryPanelRef} className="w-1/2 shrink-0 px-4 md:px-5 pb-4 md:pb-5">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="text-xs md:text-sm text-gray-500">
                            Calories Consumed
                          </p>
                          <p className="text-xl md:text-2xl font-bold text-gray-900">
                            {consumedCalories}
                            <span className="text-xs md:text-sm font-normal text-gray-500">
                              {" "}
                              / {calorieTarget} kcal
                            </span>
                          </p>
                        </div>
                        <div
                          className={`flex items-center space-x-1.5 px-2 py-0.5 rounded-full ${calorieStatus.className}`}
                        >
                          <TrendingUp className="w-4 h-4 text-emerald-500" />
                          <span className="text-xs md:text-sm font-medium">
                            {calorieStatus.label}
                          </span>
                        </div>
                      </div>

                      <p className="text-[11px] md:text-xs text-gray-500 mb-3">
                        {calorieStatus.hint}
                      </p>

                      <div className="w-full bg-gray-200/70 rounded-full h-2 mb-4 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-500 h-2 rounded-full transition-all duration-500 ease-out"
                          style={{
                            width: `${caloriesProgressPercent}%`,
                          }}
                        />
                      </div>

                      {/* ── Burn to Balance (always visible) ── */}
                      {(isOverTarget || burnedCalories > 0 || true) && (
                        <div className="mb-4 rounded-xl border border-orange-200 bg-gradient-to-br from-orange-50 to-red-50 p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs md:text-sm font-semibold text-orange-700">
                                Burn to Balance
                              </p>
                            </div>
                            {/* Status badge — only show when balanced */}
                            {isBalanced && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700">
                                ✅ Balanced
                              </span>
                            )}
                          </div>

                          {/* Burned / Extra display */}
                          <div className="flex items-end justify-between mb-1.5">
                            <div>
                              {isOverTarget ? (
                                <p className="text-xl md:text-2xl font-bold text-gray-900">
                                  {burnedCalories}
                                  <span className="text-xs md:text-sm font-normal text-gray-500">
                                    {" "}/ {extraCalories} kcal
                                  </span>
                                </p>
                              ) : (
                                <p className="text-xl md:text-2xl font-bold text-gray-900">
                                  {burnedCalories}
                                  <span className="text-xs md:text-sm font-normal text-gray-500">
                                    {" "}/ 0 kcal
                                  </span>
                                </p>
                              )}
                              {/* Show breakdown when both sources have data */}
                              {stepsBurned > 0 && watchBurned > 0 && (
                                <p className="text-[10px] text-gray-400 mt-0.5">
                                  👟 {stepsBurned} steps + ⌚ {watchBurned} watch
                                </p>
                              )}
                              {stepsBurned > 0 && watchBurned === 0 && (
                                <p className="text-[10px] text-gray-400 mt-0.5">
                                  👟 From daily steps
                                </p>
                              )}
                              {watchBurned > 0 && stepsBurned === 0 && (
                                <p className="text-[10px] text-gray-400 mt-0.5">
                                  ⌚ From smartwatch
                                </p>
                              )}
                            </div>
                            <p className="text-[11px] text-orange-600 font-medium">
                              {isOverTarget ? `${burnProgress}% burned` : "0% burned"}
                            </p>
                          </div>

                          {/* Burn progress bar */}
                          <div className="w-full bg-orange-100 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-2 rounded-full transition-all duration-700 ease-out ${
                                isBalanced
                                  ? "bg-gradient-to-r from-emerald-400 to-green-500"
                                  : "bg-gradient-to-r from-orange-400 via-red-400 to-rose-500"
                              }`}
                              style={{ width: `${burnProgress}%` }}
                            />
                          </div>

                          <p className="text-[10px] text-gray-500 mt-1.5">
                            {isBalanced
                              ? "Great work! You've balanced today's extra calories."
                              : isOverTarget
                                ? `Burn ${extraCalories - burnedCalories} more kcal to balance today's intake.`
                                : "Keep burning calories to stay active and healthy!"}
                          </p>
                        </div>
                      )}

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div className="p-2 rounded-lg bg-blue-50 flex flex-col items-center">
                          <Beef className="w-4 h-4 text-blue-600 mb-0.5" />
                          <p className="text-[10px] font-semibold text-blue-600">Protein</p>
                          <p className="text-sm font-bold text-gray-900">
                            {Math.round(dailyStats.totalProtein) || 0}g
                          </p>
                          <p className="text-[10px] text-gray-500">of 131g</p>
                        </div>
                        <div className="p-2 rounded-lg bg-orange-50 flex flex-col items-center">
                          <Wheat className="w-4 h-4 text-orange-600 mb-0.5" />
                          <p className="text-[10px] font-semibold text-orange-600">Carbs</p>
                          <p className="text-sm font-bold text-gray-900">
                            {Math.round(dailyStats.totalCarbs) || 0}g
                          </p>
                          <p className="text-[10px] text-gray-500">of 263g</p>
                        </div>
                        <div className="p-2 rounded-lg bg-yellow-50 flex flex-col items-center">
                          <Droplet className="w-4 h-4 text-yellow-600 mb-0.5" />
                          <p className="text-[10px] font-semibold text-yellow-600">Fat</p>
                          <p className="text-sm font-bold text-gray-900">
                            {Math.round(dailyStats.totalFat) || 0}g
                          </p>
                          <p className="text-[10px] text-gray-500">of 70g</p>
                        </div>
                        <div className="p-2 rounded-lg bg-green-50 flex flex-col items-center">
                          <Leaf className="w-4 h-4 text-green-600 mb-0.5" />
                          <p className="text-[10px] font-semibold text-green-600">Fiber</p>
                          <p className="text-sm font-bold text-gray-900">
                            {Math.round(dailyStats.totalFiber) || 0}g
                          </p>
                          <p className="text-[10px] text-gray-500">of 30g</p>
                        </div>
                      </div>
                    </div>

                    <div ref={trendPanelRef} className="w-1/2 shrink-0 px-4 md:px-5 pb-4 md:pb-5">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="text-xs md:text-sm text-gray-500">Calorie Trend</p>
                          <p className="text-sm md:text-base font-semibold text-gray-900">
                            Last {trendRangeDays} days
                          </p>
                        </div>
                        <div className="flex items-center gap-1 bg-gray-100 rounded-full p-1">
                          {[7, 14, 30].map((days) => (
                            <button
                              key={days}
                              type="button"
                              onClick={() => setTrendRangeDays(days)}
                              className={`px-2.5 py-1 text-[11px] md:text-xs rounded-full transition-all duration-300 ${
                                trendRangeDays === days
                                  ? "bg-emerald-500 text-white shadow-sm"
                                  : "text-gray-600 hover:bg-white"
                              }`}
                            >
                              {days}D
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                        <div className="rounded-lg bg-emerald-50 px-2 py-1.5">
                          <p className="text-[10px] text-emerald-700">Average</p>
                          <p className="text-xs md:text-sm font-semibold text-emerald-900">
                            {trendAverageCalories} kcal
                          </p>
                        </div>
                        <div className="rounded-lg bg-slate-50 px-2 py-1.5">
                          <p className="text-[10px] text-slate-600">Best Day</p>
                          <p className="text-xs md:text-sm font-semibold text-slate-900">
                            {trendBestDay
                              ? `${trendBestDay.label} (${trendBestDay.calories} kcal)`
                              : "-"}
                          </p>
                        </div>
                        <div className="rounded-lg bg-rose-50 px-2 py-1.5 col-span-2 sm:col-span-1">
                          <p className="text-[10px] text-rose-700">Above Target</p>
                          <p className="text-xs md:text-sm font-semibold text-rose-900">
                            {trendAboveTargetDays}/{calorieTrendData.length || trendRangeDays} days
                          </p>
                        </div>
                      </div>

                      {trendLoading ? (
                        <div className="h-36 rounded-xl bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100 animate-pulse" />
                      ) : calorieTrendData.length === 0 ? (
                        <div className="h-36 rounded-xl border border-dashed border-gray-200 flex items-center justify-center text-sm text-gray-500">
                          No trend data available
                        </div>
                      ) : (
                        <>
                          <div className="w-full h-44">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart
                                data={calorieChartRenderData}
                                margin={{ top: 30, right: 22, left: 0, bottom: 12 }}
                              >
                                <XAxis
                                  dataKey="label"
                                  interval={0}
                                  ticks={visibleNutritionTickLabels}
                                  padding={{ left: 6, right: 12 }}
                                  minTickGap={12}
                                  tick={{ fontSize: 10, fill: "#6b7280" }}
                                  axisLine={false}
                                  tickLine={false}
                                />
                                <YAxis
                                  width={34}
                                  tick={{ fontSize: 10, fill: "#6b7280" }}
                                  axisLine={false}
                                  tickLine={false}
                                  domain={[0, "auto"]}
                                  tickCount={6}
                                />
                                {/* <Tooltip
                                  cursor={{ stroke: "#d1d5db", strokeDasharray: "3 3" }}
                                  formatter={(value) => [`${value} kcal`, "Calories"]}
                                  labelFormatter={(label) => `${label}`}
                                /> */}

                                <ReferenceLine
                                  y={calorieTarget}
                                  stroke="#9ca3af"
                                  strokeDasharray="5 5"
                                  ifOverflow="extendDomain"
                                />

                                <Line
                                  type="linear"
                                  dataKey="calories"
                                  stroke="#16a34a"
                                  strokeWidth={2.5}
                                  dot={({ cx, cy, payload, index }) => {
                                    if (
                                      cx === undefined ||
                                      cy === undefined ||
                                      !payload ||
                                      !visibleNutritionDotIndices.has(index)
                                    ) {
                                      return null;
                                    }
                                    const isAbove = (payload.calories || 0) > calorieTarget;
                                    return (
                                      <circle
                                        key={`calorie-dot-${payload.key || index}`}
                                        cx={cx}
                                        cy={cy}
                                        r={4}
                                        fill={isAbove ? "#16a34a" : "#16a34a"}
                                      />
                                    );
                                  }}
                                  activeDot={false}
                                  isAnimationActive={false}
                                >
                                  <LabelList
                                    dataKey="calories"
                                    content={renderCaloriePointLabel}
                                  />
                                </Line>
                              </LineChart>
                            </ResponsiveContainer>
                          </div>

                          <div className="mt-3 flex items-center justify-between text-xs text-gray-600">
                            <span>Target: {calorieTarget} kcal</span>
                            <span>Avg: {trendAverageCalories} kcal</span>
                          </div>

                          {/* <div className="mt-2 flex items-center gap-3 text-[11px] text-gray-500">
                            <span className="inline-flex items-center gap-1">
                              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                              within target
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <span className="inline-block w-2 h-2 rounded-full bg-rose-500" />
                              above target
                            </span>
                          </div> */}
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pb-3 md:pb-4 flex items-center justify-center gap-2">
                  <button
                    type="button"
                    aria-label="Go to summary slide"
                    onClick={() => setActiveOverviewPanel("summary")}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      activeOverviewPanel === "summary"
                        ? "w-6 bg-emerald-500"
                        : "w-2.5 bg-gray-300 hover:bg-gray-400"
                    }`}
                  />
                  <button
                    type="button"
                    aria-label="Go to trend slide"
                    onClick={() => setActiveOverviewPanel("trend")}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      activeOverviewPanel === "trend"
                        ? "w-6 bg-emerald-500"
                        : "w-2.5 bg-gray-300 hover:bg-gray-400"
                    }`}
                  />
                </div>
              </div>
            </div>
            {/* Meals */}
            <div className="px-4 md:px-6 space-y-4">
              {(() => {
                // NEW: decide empty vs list based on *actual* items and placeholders
                const hasUndoPlaceholders = analyses.some(
                  (a) => a.isUndoPlaceholder,
                );
                const hasRealMeals = analyses.some((a) => !a.isUndoPlaceholder);

                if (!hasRealMeals && !hasUndoPlaceholders) {
                  return (
                    <div className="text-center py-16 px-6 backdrop-blur-xl bg-white/30 rounded-2xl shadow-lg border border-white/40">
                      <div className="text-6xl mb-4">🥗</div>
                      <h3 className="text-xl font-semibold text-gray-800 mb-2">
                        No Meals Logged
                      </h3>
                      <p className="text-gray-600 max-w-xs mx-auto">
                        Use the camera to snap a photo of your food and see your
                        nutrition insights here.
                      </p>
                    </div>
                  );
                }

                // ✅ GROUP DISPLAYED MEALS (not all analyses)
                const groupedDisplayedMeals = displayedMeals.reduce(
                  (acc, analysis) => {
                    const category = getMealCategory(analysis.CreatedAt);
                    if (!acc[category]) acc[category] = [];
                    acc[category].push(analysis);
                    return acc;
                  },
                  {},
                );

                return (
                  <>
                    {[
                      "breakfast",
                      "morning-snack",
                      "lunch",
                      "evening-snack",
                      "dinner",
                      "late-night",
                    ].map((category) => {
                      const meals = groupedDisplayedMeals[category] || [];
                      if (meals.length === 0) return null;

                      const categoryInfo = getMealCategoryInfo(category);
                      const categoryCalories = meals.reduce((sum, meal) => {
                        if (meal.isUndoPlaceholder) return sum;
                        const foodData = parseAnalysisData(meal.AnalysisData);
                        return (
                          sum +
                          (foodData.nutrition.calories ||
                            meal.TotalCalories ||
                            0)
                        );
                      }, 0);

                      return (
                        <div key={category}>
                          <div className="flex items-center justify-between mb-3 px-2">
                            <div>
                              <h3 className="text-lg font-semibold text-gray-800">
                                {categoryInfo.name}
                              </h3>
                              <p className="text-sm text-gray-500">
                                {formatTimeRangeAMPM(categoryInfo.timeRange)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-base font-semibold text-gray-800">
                                {Math.round(categoryCalories)}
                              </p>
                              <p className="text-xs text-gray-500">kcal</p>
                            </div>
                          </div>

                          <div className="space-y-3">
                            {meals
                              .slice()
                              .sort((a, b) => {
                                const dateA = istToLocalDate(a.CreatedAt);
                                const dateB = istToLocalDate(b.CreatedAt);
                                return dateA - dateB;
                              })
                              .map((meal, mealIndex) => {
                                // Show undo row if this is a placeholder
                                if (meal.isUndoPlaceholder) {
                                  const entry = undoState[meal.ID];
                                  if (!entry) return null;
                                  return (
                                    <UndoRow
                                      key={`${meal.ID}-${mealIndex}`}
                                      pid={meal.ID}
                                      originalMeal={entry.originalMeal}
                                      expiresAt={entry.expiresAt}
                                      ttlSeconds={
                                        entry.ttlSeconds ?? UNDO_SECONDS
                                      }
                                    />
                                  );
                                }

                                // Regular meal card
                                const foodData = parseAnalysisData(
                                  meal.AnalysisData,
                                );
                                const mealTime = istToLocalDate(
                                  meal.CreatedAt,
                                ).toLocaleTimeString("en-US", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                });
                                const calories =
                                  foodData.nutrition.calories ||
                                  meal.TotalCalories ||
                                  0;

                                return (
                                  <MealCard
                                    key={`${meal.ID}-${mealIndex}`}
                                    meal={meal}
                                    foodData={foodData}
                                    mealTime={mealTime}
                                    calories={calories}
                                    onDelete={handleOptimisticDelete}
                                    onClick={(mealObj) =>
                                      setSelectedMeal(mealObj)
                                    }
                                  />
                                );
                              })}
                          </div>
                        </div>
                      );
                    })}

                    {/* ✅ INFINITE SCROLL SENTINEL */}
                    {hasMoreMeals && (
                      <div
                        ref={sentinelRef}
                        className="py-4 flex justify-center"
                      >
                        {loadingMore && (
                          <div className="flex items-center gap-2 text-emerald-600">
                            <div className="animate-spin rounded-full h-5 w-5 border-2 border-emerald-300 border-t-emerald-600"></div>
                            <span className="text-sm font-medium">
                              Loading more meals...
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </>
        )}
      </div>

      {/* Modal */}
      {selectedMeal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end justify-center p-4"
          onClick={isSaving || saveStatus ? undefined : handleCloseModal}
        >
          <div
            className={`bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden transition-all duration-500 ease-in-out ${
              isClosingModal ? "animate-slideDown" : "animate-slideUp"
            } ${isEditing ? "max-h-[90vh]" : "max-h-[80vh]"} relative`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Success/Error Status Overlay */}
            {saveStatus && (
              <div className="absolute inset-0 bg-white rounded-3xl flex items-center justify-center z-10 animate-fadeIn">
                <div className="text-center p-8">
                  {saveStatus === "success" ? (
                    <>
                      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                        <svg
                          className="w-10 h-10 text-green-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </div>
                      <h3 className="text-2xl font-bold text-gray-900 mb-2">
                        Changes Saved!
                      </h3>
                      <p className="text-sm text-green-600 font-medium">
                        Your meal has been updated successfully
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                        <svg
                          className="w-10 h-10 text-red-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </div>
                      <h3 className="text-2xl font-bold text-gray-900 mb-2">
                        Update Failed
                      </h3>
                      <p className="text-sm text-gray-500 mb-4">
                        Unable to save changes. Please try again.
                      </p>
                      <button
                        onClick={() => setSaveStatus(null)}
                        className="bg-red-500 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-red-600 transition-colors"
                      >
                        Try Again
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Saving indicator overlay - DISABLED for auto-save UX */}
            {/* {isSaving && !saveStatus && (
              <div className="absolute inset-0 bg-white/95 rounded-3xl flex items-center justify-center z-10 animate-fadeIn">
                <div className="text-center p-8">
                  <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <div className="w-10 h-10 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Saving Changes...</h3>
                  <p className="text-sm text-gray-500">Updating your meal data</p>
                </div>
              </div>
            )} */}

            {(() => {
              // Use white for '+ {others} more' in modal
              const foodData = parseAnalysisData(
                selectedMeal.AnalysisData,
                "text-white",
              );
              const mealTime = istToLocalDate(
                selectedMeal.CreatedAt,
              ).toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
              });

              // Use local nutrition if available (updated via editing), otherwise use original data
              const calories =
                localNutrition.calories ||
                foodData.nutrition.calories ||
                selectedMeal.TotalCalories ||
                0;
              const protein =
                localNutrition.protein ||
                foodData.nutrition.protein ||
                selectedMeal.TotalProtein ||
                0;
              const carbs =
                localNutrition.carbs ||
                foodData.nutrition.carbs ||
                selectedMeal.TotalCarbs ||
                0;
              const fat =
                localNutrition.fat ||
                foodData.nutrition.fat ||
                selectedMeal.TotalFat ||
                0;
              const fiber =
                localNutrition.fiber ||
                foodData.nutrition.fiber ||
                selectedMeal.TotalFiber ||
                0;

              return (
                <div
                  className="relative flex flex-col"
                  style={{ maxHeight: isEditing ? "90vh" : "80vh" }}
                >
                  {/* Image header */}
                  <div className="relative">
                    {selectedMeal.ImageBase64 &&
                    selectedMeal.ImageBase64.trim() !== "" ? (
                      <img
                        src={
                          selectedMeal.ImageBase64.startsWith("data:image")
                            ? selectedMeal.ImageBase64
                            : `data:image/jpeg;base64,${selectedMeal.ImageBase64}`
                        }
                        alt={foodData.name}
                        className={`w-full object-cover transition-all duration-500 ease-in-out ${
                          isEditing ? "h-48" : "h-72"
                        }`}
                        onError={(e) => {
                          e.target.src =
                            "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=880&q=80";
                        }}
                      />
                    ) : selectedMeal.ImagePath ? (
                      <img
                        src={selectedMeal.ImagePath}
                        alt={foodData.name}
                        className={`w-full object-cover transition-all duration-500 ease-in-out ${
                          isEditing ? "h-48" : "h-72"
                        }`}
                        onError={(e) => {
                          e.target.src =
                            "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=880&q=80";
                        }}
                      />
                    ) : (
                      <div
                        className={`w-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center transition-all duration-500 ease-in-out ${
                          isEditing ? "h-48" : "h-72"
                        }`}
                      >
                        <svg
                          className="w-12 h-12 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                      </div>
                    )}

                    <div
                      className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent transition-all duration-500 ease-in-out ${
                        isEditing ? "p-3 space-y-1" : "p-5 space-y-3"
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h2
                            className={`font-bold text-white leading-tight transition-all duration-500 ease-in-out ${
                              isEditing ? "text-lg" : "text-xl"
                            }`}
                          >
                            {foodData.name}
                          </h2>
                          <p
                            className={`text-white/70 mt-0.5 transition-all duration-500 ease-in-out ${
                              isEditing ? "text-[10px]" : "text-xs"
                            }`}
                          >
                            Logged at {mealTime}
                          </p>
                        </div>
                        <div className="text-right">
                          <span
                            className={`font-bold text-white transition-all duration-500 ease-in-out ${
                              isEditing ? "text-2xl" : "text-3xl"
                            }`}
                          >
                            {Math.round(calories)}
                          </span>
                          <span
                            className={`text-white/70 ml-1 transition-all duration-500 ease-in-out ${
                              isEditing ? "text-[10px]" : "text-xs"
                            }`}
                          >
                            kcal
                          </span>
                        </div>
                      </div>

                      <div
                        className={`flex flex-wrap gap-2 pt-1 overflow-hidden transition-all duration-500 ease-in-out ${
                          isEditing
                            ? "max-h-0 opacity-0"
                            : "max-h-20 opacity-100"
                        }`}
                      >
                        <div className="flex items-center bg-white/15 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-sm border border-white/10">
                          <Beef className="w-4 h-4 text-white mr-1.5" />
                          <span className="text-xs font-medium text-white">
                            {Math.round(protein)}g
                          </span>
                        </div>
                        <div className="flex items-center bg-white/15 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-sm border border-white/10">
                          <Wheat className="w-4 h-4 text-white mr-1.5" />
                          <span className="text-xs font-medium text-white">
                            {Math.round(carbs)}g
                          </span>
                        </div>
                        <div className="flex items-center bg-white/15 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-sm border border-white/10">
                          <Droplet className="w-4 h-4 text-white mr-1.5" />
                          <span className="text-xs font-medium text-white">
                            {Math.round(fat)}g
                          </span>
                        </div>
                        <div className="flex items-center bg-white/15 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-sm border border-white/10">
                          <Leaf className="w-4 h-4 text-white mr-1.5" />
                          <span className="text-xs font-medium text-white">
                            {Math.round(fiber)}g
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={handleCloseModal}
                      disabled={isSaving || saveStatus}
                      className={`absolute top-4 right-4 w-9 h-9 bg-black/40 backdrop-blur-sm text-white rounded-full flex items-center justify-center transition-all duration-200 border border-white/20 ${
                        isSaving || saveStatus
                          ? "opacity-50 cursor-not-allowed"
                          : "hover:bg-black/60"
                      }`}
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>

                  {/* Food Items - Editable */}
                  <div
                    className="p-4 overflow-y-auto transition-all duration-500 ease-in-out"
                    style={{ maxHeight: isEditing ? "60vh" : "40vh" }}
                  >
                    {localDetailedItems?.length > 0 && (
                      <div
                        className={`space-y-3 transition-all duration-500 ease-in-out ${
                          isEditing
                            ? "translate-y-0 opacity-100"
                            : "translate-y-0 opacity-100"
                        }`}
                      >
                        <h3 className="font-semibold text-gray-900 text-sm flex items-center">
                          <svg
                            className="w-5 h-5 text-gray-500 mr-1.5 inline-flex align-middle translate-y-[2px] translate-x-[2px]"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 5H7a2 2 0 00-2 2v1a2 2 0 002 2h2m0-8v8m0-8h2a2 2 0 012 2v1a2 2 0 01-2 2H9m-4 0v6a2 2 0 002 2h2a2 2 0 002-2V9.5"
                            />
                          </svg>
                          Food Items
                        </h3>
                        <div
                          className={`space-y-2 transition-all duration-500 ease-in-out transform ${
                            isEditing ? "scale-100" : "scale-100"
                          }`}
                        >
                          {[...localDetailedItems]
                            .map((item, originalIndex) => ({
                              item,
                              originalIndex,
                              calories:
                                item?.nutrition?.calories || item?.calories || 0,
                            }))
                            .sort((a, b) => b.calories - a.calories)
                            .map(({ item, originalIndex }) => (
                            <div
                              key={`${originalIndex}-${resetKey}`}
                              className="transition-all duration-500 ease-in-out"
                            >
                              <EditableFoodItem
                                ref={(el) =>
                                  (itemRefs.current[originalIndex] = el)
                                }
                                foodItem={item}
                                index={originalIndex}
                                onUpdate={handleFoodUpdate}
                                onDelete={handleDeleteFoodItem}
                                onRestore={handleRestoreFoodItem}
                                onEditingChange={handleEditingChange}
                                disabled={
                                  isEditing && !editingStates[originalIndex]
                                }
                                hideButtons={false}
                                user={user}
                              />
                            </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action buttons area */}
                  {isEditing ? null : (
                    // Delete button when not editing
                    <div className="p-4 pt-0">
                      <TouchFeedbackButton
                        disabled={deletingId === selectedMeal?.ID}
                        className={`w-full flex items-center justify-center gap-2 rounded-lg text-white text-sm font-medium px-4 py-2 shadow-sm transition-all duration-200 ${
                          deletingId === selectedMeal?.ID
                            ? "bg-red-400 cursor-not-allowed"
                            : "bg-red-500 hover:bg-red-600 hover:shadow-md active:scale-95"
                        }`}
                        onClick={async () => {
                          if (!selectedMeal?.ID) return;

                          // Capture the meal reference immediately (modal will close)
                          const meal = selectedMeal;
                          setDeletingId(meal.ID);

                          // Compute nutrition deltas for instant feedback
                          const n =
                            parseAnalysisData(meal.AnalysisData).nutrition ||
                            {};
                          const deltas = {
                            calories: -(n.calories || meal.TotalCalories || 0),
                            protein: -(n.protein || meal.TotalProtein || 0),
                            carbs: -(n.carbs || meal.TotalCarbs || 0),
                            fat: -(n.fat || meal.TotalFat || 0),
                            fiber: -(n.fiber || meal.TotalFiber || 0),
                            mealCountDelta: -1,
                          };

                          // Build placeholder that sorts in the same slot
                          const placeholder = {
                            ID: `undo-${meal.ID}`,
                            isUndoPlaceholder: true,
                            CreatedAt: meal.CreatedAt,
                          };

                          // --- OPTIMISTIC UI ---
                          // Replace the meal in-place with the placeholder (no flicker/snap-back)
                          setAnalyses((prev) => {
                            const idx = prev.findIndex((m) => m.ID === meal.ID);
                            if (idx === -1) {
                              // Fallback: remove then append placeholder
                              return prev
                                .filter((m) => m.ID !== meal.ID)
                                .concat(placeholder);
                            }
                            const next = prev.slice();
                            next.splice(idx, 1, placeholder);
                            return next;
                          });

                          // Start undo countdown
                          setUndoState((prev) => ({
                            ...prev,
                            [placeholder.ID]: {
                              originalMeal: meal,
                              expiresAt: Date.now() + UNDO_SECONDS * 1000, // absolute expiry
                              ttlSeconds: UNDO_SECONDS,
                            },
                          }));

                          // Update totals immediately
                          applyDailyDelta(deltas);

                          // Close modal immediately for a snappy feel
                          setSelectedMeal(null);

                          // --- Server call; rollback if it fails ---
                          try {
                            const res = await fetch(
                              `${apiBaseUrl}/api/delete-background-analysis`,
                              {
                                method: "DELETE",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  id: meal.ID,
                                  userId: user?.id,
                                }),
                              },
                            );
                            const data = await res.json();
                            if (!data.success)
                              throw new Error(
                                data.message || "Failed to delete.",
                              );
                            if (onMealDelete) onMealDelete(meal.ID);
                          } catch (err) {
                            // Rollback: remove placeholder, restore meal in-place, reverse deltas
                            setAnalyses((prev) => {
                              const idx = prev.findIndex(
                                (m) => m.ID === placeholder.ID,
                              );
                              if (idx === -1) return prev; // nothing to rollback
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

                            setError(
                              err.message ||
                                "Failed to delete. Please try again.",
                            );
                            setTimeout(() => setError(null), 5000); // Clear after 5 seconds
                          } finally {
                            setDeletingId(null);
                          }
                        }}
                      >
                        {deletingId === selectedMeal?.ID ? (
                          <>
                            <span className="inline-block h-4 w-4 rounded-full border-2 border-white/70 border-t-white animate-spin" />
                            Deleting…
                          </>
                        ) : (
                          <>
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 
                                1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                            Delete
                          </>
                        )}
                      </TouchFeedbackButton>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

export default NutritionDashboard;

// --- MealCard with creative, minimal swipe-left to delete (progress bar) ---
const SWIPE_DELETE_THRESHOLD = 140; // px
const SWIPE_MAX = 140; // px

const MealCard = ({
  meal,
  foodData,
  mealTime,
  calories,
  onDelete,
  onClick,
}) => {
  const [dx, setDx] = React.useState(0);
  const [dragging, setDragging] = React.useState(false);
  const [animating, setAnimating] = React.useState(false);
  const [armed, setArmed] = React.useState(false);
  const [leaving, setLeaving] = React.useState(false); // NEW: card is exiting
  const [deletedOnce, setDeletedOnce] = React.useState(false); // NEW: guard

  const startXRef = React.useRef(0);
  const rafRef = React.useRef(null);
  const elRef = React.useRef(null);

  const cancelRAF = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const onPointerDown = (e) => {
    if (!e.isPrimary || leaving) return;
    cancelRAF();
    setDragging(true);
    setAnimating(false);
    startXRef.current = e.clientX;
    elRef.current?.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (!dragging || !e.isPrimary || leaving) return;
    const delta = e.clientX - startXRef.current;
    const nextDx = Math.max(Math.min(delta, 0), -SWIPE_MAX);
    if (!rafRef.current) {
      rafRef.current = requestAnimationFrame(() => {
        setDx(nextDx);
        rafRef.current = null;
        const isNowArmed = Math.abs(nextDx) >= SWIPE_DELETE_THRESHOLD;
        if (isNowArmed !== armed) {
          setArmed(isNowArmed);
          if (
            isNowArmed &&
            typeof navigator !== "undefined" &&
            "vibrate" in navigator
          ) {
            try {
              navigator.vibrate(10);
            } catch {}
          }
        }
      });
    }
  };

  const finishInteraction = (e) => {
    if (!dragging) return;
    setDragging(false);
    cancelRAF();
    elRef.current?.releasePointerCapture?.(e?.pointerId);

    if (Math.abs(dx) >= SWIPE_DELETE_THRESHOLD) {
      if (deletedOnce) return; // guard against double fire
      setDeletedOnce(true);
      setLeaving(true); // lock input & visuals
      setAnimating(true);

      // Slide out and let parent replace with placeholder immediately
      requestAnimationFrame(() => {
        setDx(-window.innerWidth);
        setTimeout(() => {
          onDelete(meal); // optimistic replace (in-place)
          // Do NOT reset dx or animating; this component will unmount next render.
        }, 180); // exit timing tuned for snap-free feel
      });

      return;
    }

    // Not past threshold: snap back
    setAnimating(true);
    requestAnimationFrame(() => {
      setDx(0);
      setTimeout(() => {
        setAnimating(false);
        setArmed(false);
      }, 220);
    });
  };

  const onPointerUp = (e) => finishInteraction(e);
  const onPointerCancel = (e) => finishInteraction(e);
  const onPointerLeave = (e) => finishInteraction(e);

  React.useEffect(() => () => cancelRAF(), []);

  const progress = Math.min(1, Math.abs(dx) / SWIPE_DELETE_THRESHOLD);
  const scale = leaving ? 1 : 1 - Math.min(0.03, Math.abs(dx) / 1000);

  return (
    // Keep a fixed height so layout doesn’t jump while swapping for placeholder
    <div
      className="relative w-full"
      style={{ touchAction: "pan-y", height: 84 }}
    >
      {/* Background delete reveal (only visible while dragging, never after unmount) */}
      <div
        aria-hidden
        className="absolute inset-0 z-0 flex items-center justify-end pr-5 overflow-hidden rounded-xl"
      >
        <div
          className="flex items-center justify-center w-12 h-12 bg-red-500 rounded-full"
          style={{
            opacity: progress,
            transform: `scale(${0.6 + progress * 0.4})`,
            transition: dragging
              ? "none"
              : "transform 160ms ease, opacity 160ms ease",
          }}
        >
          <svg
            className="w-6 h-6 text-white"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            style={{
              transform: `rotate(${armed ? 10 : 0}deg)`,
              transition: "transform 160ms cubic-bezier(.2,.8,.2,1.2)",
              strokeWidth: armed ? 2.2 : 2,
            }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16"
            />
          </svg>
        </div>
      </div>

      {/* Foreground card */}
      <div
        ref={elRef}
        role="button"
        aria-label={`${foodData.name}, ${Math.round(calories)} kilocalories`}
        tabIndex={0}
        onKeyDown={(e) => {
          if (leaving) return;
          if (e.key === "Backspace" || e.key === "Delete") finishInteraction(e); // go through same flow
          if (e.key === "Enter") onClick(meal);
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onPointerLeave={onPointerLeave}
        onClick={() => {
          if (!dragging && Math.abs(dx) < 5 && !leaving) onClick(meal);
        }}
        className={`relative z-10 bg-white/70 backdrop-blur-xl border border-gray-200/80 rounded-xl select-none cursor-pointer overflow-hidden
          ${leaving ? "pointer-events-none" : ""}`}
        style={{
          transform: `translateX(${dx}px) scale(${scale})`,
          transition: animating
            ? "transform 180ms cubic-bezier(.2,.8,.2,1.1), box-shadow 180ms ease"
            : "none",
          minHeight: 76,
          willChange: "transform",
          boxShadow: `
            0 10px 30px -10px rgba(0,0,0,${progress * 0.15 + 0.05}),
            inset 0 0 0 1px rgba(0,0,0,0.05)
          `,
        }}
      >
        {/* Bottom progress bar (feedback while swiping) */}
        <div
          className="absolute bottom-0 left-0 h-0.5 bg-red-500 rounded-b-xl"
          style={{
            width: `${progress * 100}%`,
            transition: dragging ? "none" : "width 180ms ease",
            opacity: progress > 0 ? 1 : 0,
          }}
        />

        <div className="p-4 flex items-center gap-4">
          <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden shrink-0">
            {meal.ImageBase64 && meal.ImageBase64.trim() !== "" ? (
              <img
                src={
                  meal.ImageBase64.startsWith("data:image")
                    ? meal.ImageBase64
                    : `data:image/jpeg;base64,${meal.ImageBase64}`
                }
                alt={foodData.name}
                className="w-full h-full object-cover"
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            ) : meal.ImagePath ? (
              <img
                src={meal.ImagePath}
                alt={foodData.name}
                className="w-full h-full object-cover"
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            ) : (
              <span className="text-2xl">🍽️</span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-gray-900 truncate">
              {foodData.name}
            </h4>
            <p className="text-sm text-gray-500">{mealTime}</p>
          </div>

          <div className="text-right">
            <p className="font-bold text-lg text-gray-900">
              {Math.round(calories)}
            </p>
            <p className="text-[11px] text-gray-500 -mt-0.5 tracking-wide">
              kcal
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

