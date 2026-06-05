// src/components/EditableFoodItem.js
import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from "react";
import { geminiService } from "../../../shared/services/geminiService";
import { saveFoodCorrection } from "../services/foodCorrectionService";
import {
  getUserContext,
  getUserId,
} from "../../../shared/services/userIdentity";
import {
  generateServingOptions,
  computeNutrition,
} from "../services/nutritionMath";
import { planFoodCorrection } from "../services/foodCorrectionPlan";
import { useDeleteWithUndo } from "../hooks/useDeleteWithUndo";
import TouchFeedbackButton from "../../../shared/components/TouchFeedbackButton";
import {
  Search,
  Edit2,
  Save,
  X,
  Utensils,
  Flame,
  Beef,
  Wheat,
  Droplet,
  Leaf,
  Trash2,
} from "lucide-react";
import BathroomScaleIcon from "../../../shared/components/icons/BathroomScaleIcon";
import { debugLog } from '../../../shared/utils/logger.js';

const DELETE_UNDO_SECONDS = 5;

/**
 * Editable food item component for nutrition breakdown
 * Allows users to search and replace food items with accurate serving sizes
 */
const EditableFoodItem = forwardRef(
  (
    {
      foodItem,
      onUpdate,
      onDelete,
      index,
      onEditingChange,
      disabled,
      onSave,
      onCancel,
      hideButtons,
      user,
      onRestore,
    },
    ref,
  ) => {
    // Display/Edit mode toggle
    const [isEditing, setIsEditing] = useState(false);

    // Search state
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [searchError, setSearchError] = useState(null);
    const [selectedFood, setSelectedFood] = useState(null);

    // Serving size state
    const [currentServing, setCurrentServing] = useState(null);
    const [currentServingIndex, setCurrentServingIndex] = useState(0);
    const [customGrams, setCustomGrams] = useState("");
    const [servingOptions, setServingOptions] = useState([]);
    const [isServingDropdownOpen, setIsServingDropdownOpen] = useState(false);

    // Original values for cancel
    const originalFoodRef = useRef(foodItem);
    const searchTimeoutRef = useRef(null);

    // Cache userId to avoid repeated API calls
    const userIdRef = useRef(user?.id || null);

    // Auto-save timer ref (Phase 1: Debounced Auto-Save)
    const autoSaveTimeoutRef = useRef(null);

    // Track if user has made changes (Phase 1: Prevent auto-save on edit mode entry)
    const hasUserChangesRef = useRef(false);

    // Track if Phase 2 instant save is in progress (prevents Phase 1 from interfering)
    const isInstantSavingRef = useRef(false);

    // Track if correction has been saved (to avoid duplicate saves)
    const correctionSavedRef = useRef(false);

    // Phase 3: Sync status indicator
    const [syncStatus, setSyncStatus] = useState("idle"); // idle|syncing|saved|error|retrying
    const syncStatusTimeoutRef = useRef(null);

    // Phase 5: Retry logic
    const [retryCount, setRetryCount] = useState(0);
    const maxRetries = 3;
    const retryTimeoutRef = useRef(null);

    // Phase 7: AbortController to cancel pending saves
    const abortControllerRef = useRef(null);

    const {
      isDeletePending,
      deleteCountdown,
      deleteAnimKey,
      handleDelete,
      handleUndoDelete,
    } = useDeleteWithUndo({
      disabled,
      onDelete,
      onRestore,
      index,
      itemSnapshot: foodItem,
      undoSeconds: DELETE_UNDO_SECONDS,
    });

    // Define handleDone as forward reference (implementation below)
    const handleDoneRef = useRef();
    const handleCancelRef = useRef();

    // Expose save and cancel methods to parent via ref
    useImperativeHandle(ref, () => ({
      save: (...args) => handleDoneRef.current?.(...args),
      cancel: (...args) => handleCancelRef.current?.(...args),
      isEditing,
    }));

    // Notify parent when editing state changes or sync status changes
    useEffect(() => {
      if (onEditingChange) {
        // Pass editing state and whether actively saving/retrying (blocking close)
        const isBlocking = syncStatus === "retrying";
        onEditingChange(index, isEditing, isBlocking);
      }
    }, [isEditing, syncStatus, index, onEditingChange]);

    // Initialize with current food item data
    // This preserves the original weight when entering edit mode
    // Skip updates when in edit mode to prevent auto-save from resetting the UI
    useEffect(() => {
      if (foodItem && !isEditing) {
        const grams = foodItem.serving?.grams || foodItem.grams || "";
        setCustomGrams(grams);
      }
    }, [foodItem, isEditing]);

    // Smart debounced search with prefetching
    const debouncedSearch = useCallback((query) => {
      const trimmed = query.trim();

      // Cancel previous timeout first
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = null;
      }

      // Validation: minimum 3 characters
      if (trimmed.length < 3) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      // Clear previous errors when user types
      setSearchError(null);

      // Check cache first (synchronous, instant)
      const cached = geminiService.getCachedSearch(trimmed);
      if (cached) {
        setSearchResults(cached.results || []);
        setIsSearching(false);
        setSearchError(null);
        return;
      }

      // Set loading state
      setIsSearching(true);
      setSearchError(null);

      // Debounce the API call - only execute after 800ms of no typing
      searchTimeoutRef.current = setTimeout(async () => {
        try {
          const results = await geminiService.searchFood(trimmed);
          setSearchResults(results.results || []);
          setSearchError(null);
        } catch (error) {
          // Preserve existing results, show user-friendly error
          setSearchResults([]);

          // Determine error type and set appropriate message
          if (
            error.message?.includes("429") ||
            error.message?.includes("Resource exhausted")
          ) {
            setSearchError(
              "Search limit reached. Please try again in a moment.",
            );
          } else if (
            error.message?.includes("network") ||
            error.message?.includes("fetch")
          ) {
            setSearchError("Network error. Please check your connection.");
          } else {
            setSearchError(
              "Search failed. You can still edit the current food.",
            );
          }
        } finally {
          setIsSearching(false);
          searchTimeoutRef.current = null;
        }
      }, 800); // 800ms debounce delay (optimized for token efficiency)
    }, []); // Empty deps is safe - uses refs and state setters

    // Cleanup timeout on unmount
    useEffect(() => {
      return () => {
        if (searchTimeoutRef.current) {
          clearTimeout(searchTimeoutRef.current);
        }
        // Phase 1: Cleanup auto-save timer on unmount
        if (autoSaveTimeoutRef.current) {
          clearTimeout(autoSaveTimeoutRef.current);
        }
        // Phase 5: Cleanup retry timeout on unmount
        if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current);
        }
      };
    }, []);

    // Handle search input with prefetching
    const handleSearchInput = (e) => {
      const value = e.target.value;
      setSearchQuery(value);
      setSelectedFood(null);
      setServingOptions([]);
      setSearchError(null); // Clear errors when typing
      
      // Reset correction saved flag to allow saving the new food name
      correctionSavedRef.current = false;

      // Trigger debounced search
      debouncedSearch(value);
    };

    // Select food from search results
    const handleFoodSelect = async (food) => {
      debugLog("[CORRECTION DEBUG] handleFoodSelect triggered");
      debugLog(
        "[CORRECTION DEBUG] Original food:",
        originalFoodRef.current?.name,
      );
      debugLog("[CORRECTION DEBUG] New food selected:", food.name);
      debugLog("\nðŸ” [GRAM/ML DEBUG] Selected food properties:");
      debugLog("   - food.name:", food.name);
      debugLog("   - food.isLiquid:", food.isLiquid);
      debugLog("   - food.unit:", food.unit);
      debugLog("   - food.defaultServing:", food.defaultServing);
      debugLog("   - food.per100g:", food.per100g);

      setSelectedFood(food);
      setSearchQuery(food.name);
      setSearchResults([]);

      // ✅ CRITICAL FIX: Mark that user made a change (food selection)
      // This ensures "Close Edit" button will save the change
      hasUserChangesRef.current = true;
      debugLog("   ✅ Marked as user change - will save on Close Edit");

      // Mark that name has changed - correction will be saved in handleAutoSave with final nutrition data
      const originalName = originalFoodRef.current?.name;
      const newName = food.name;
      
      if (
        originalName &&
        newName &&
        originalName.trim().toLowerCase() !== newName.trim().toLowerCase()
      ) {
        debugLog("[CORRECTION DEBUG] ✅ Name changed - will save correction after serving adjustment");
        correctionSavedRef.current = false; // Reset to allow saving in handleAutoSave
      }

      // Get userId and cache it for later use in handleAutoSave
      try {
        if (!userIdRef.current && user) {
          debugLog("[CORRECTION DEBUG] Caching userId for later...");
          const userId = await getUserId(user);
          if (userId) {
            userIdRef.current = userId;
          }
        }
      } catch (error) {
        console.error("[CORRECTION DEBUG] Failed to cache userId:", error);
      }

      // REMOVED: Correction save moved to handleAutoSave
      // The old code saved correction here without nutrition data
      // Now it will save in handleAutoSave with final serving size and nutrition
      

      // Generate serving options locally using our consistent logic
      // IMPORTANT: Preserve the user's existing unit if they already have a value entered
      const existingGrams = parseFloat(customGrams);
      const hasExistingWeight = !isNaN(existingGrams) && existingGrams > 0;

      // Extract the original unit from the foodItem being edited
      let existingUnit = null;
      if (hasExistingWeight && foodItem) {
        // Try to extract unit from original food item's serving description
        const originalDesc =
          foodItem.serving?.description || foodItem.portionDescription || "";
        const unitMatch = originalDesc.match(/([a-zA-Z]+)\s*$/);
        existingUnit = unitMatch ? unitMatch[1] : null;
        debugLog(
          `ðŸ” Original unit from foodItem: "${existingUnit}" (from: "${originalDesc}")`,
        );
      }

      // Determine which serving description to use as base
      let baseServingDescription;
      let baseServingGrams;

      if (hasExistingWeight && existingUnit) {
        // User already has a weight with a unit - preserve their unit
        // Use existing weight with preserved unit
        const quantity = existingGrams / food.defaultServing.grams;
        baseServingDescription = `${quantity.toFixed(
          quantity % 1 === 0 ? 0 : 1,
        )} ${existingUnit}`;
        baseServingGrams = existingGrams;
        debugLog(
          `✅ Preserving user's existing unit: ${existingUnit} with ${existingGrams}ml as "${baseServingDescription}"`,
        );
      } else {
        // No existing unit - use API's default serving
        baseServingDescription = food.defaultServing.description;
        baseServingGrams = food.defaultServing.grams;
      }

      // Use the determined base serving for generating options
      const baseServingForOptions = {
        grams: baseServingGrams,
        nutrition:
          hasExistingWeight && food.per100g
            ? {
                calories: Math.round(
                  (food.per100g.calories * baseServingGrams) / 100,
                ),
                protein: Math.ceil(
                  (food.per100g.protein * baseServingGrams) / 100,
                ),
                carbs: Math.ceil((food.per100g.carbs * baseServingGrams) / 100),
                fat: Math.ceil((food.per100g.fat * baseServingGrams) / 100),
                fiber: Math.ceil(
                  ((food.per100g.fiber || 0) * baseServingGrams) / 100,
                ),
              }
            : food.defaultServing.nutrition,
      };

      let options = [];

      // Check if per100g data is available to generate dynamic options
      if (food.per100g && food.per100g.calories > 0) {
        // Generate dynamic serving options using our proven algorithm
        options = generateServingOptions(
          baseServingForOptions,
          food.per100g,
          food.name,
          baseServingDescription,
        );
        debugLog(
          `✅ Generated ${options.length} consistent serving options locally`,
        );
      } else {
        // Fallback: just use default serving if no per100g data
        options = [
          {
            description: baseServingDescription,
            grams: baseServingGrams,
            nutrition: baseServingForOptions.nutrition,
            isDefault: true,
          },
        ];
      }

      setServingOptions(options);

      debugLog("\nðŸ½ï¸ [GRAM/ML DEBUG] Generated", options.length, "serving options:");
      options.slice(0, 3).forEach((opt, idx) => {
        debugLog(`   [${idx}]:`, opt.description, "-", opt.grams, "g/ml");
      });
      if (options.length > 3) debugLog("   ... and", options.length - 3, "more options");

      // Find the closest serving option to the existing weight (for display purposes)
      if (hasExistingWeight) {
        const closestIndex = options.reduce((closestIdx, opt, idx) => {
          const currentDiff = Math.abs(
            options[closestIdx].grams - existingGrams,
          );
          const newDiff = Math.abs(opt.grams - existingGrams);
          return newDiff < currentDiff ? idx : closestIdx;
        }, 0);

        setCurrentServing(options[closestIndex]);
        setCurrentServingIndex(closestIndex);
        debugLog("   ✅ Kept existing weight:", existingGrams, "g/ml (closest option index:", closestIndex, ")");
        // Keep the existing customGrams value - DO NOT override it
      } else {
        // Fallback to default serving only if no valid existing weight
        setCurrentServing(options[0]);
        setCurrentServingIndex(0);
        setCustomGrams(options[0].grams.toString());
        debugLog("   ✅ Set default serving:", options[0].description, "-", options[0].grams, "g/ml");
      }

    };

    // Handle custom grams input
    const handleGramsChange = (e) => {
      let value = e.target.value;

      debugLog("\nâŒ¨ï¸ [GRAM/ML DEBUG] User typing in input:");
      debugLog("   - Raw input value:", value);
      debugLog("   - Previous customGrams:", customGrams);

      // Strip any non-numeric characters except decimal point
      value = value.replace(/[^0-9.]/g, '');
      
      // Ensure only one decimal point
      const parts = value.split('.');
      if (parts.length > 2) {
        value = parts[0] + '.' + parts.slice(1).join('');
      }

      debugLog("   - Sanitized value:", value);

      // Allow only numbers and decimal point
      if (value === "" || /^\d*\.?\d*$/.test(value)) {
        setCustomGrams(value);
        debugLog("   ✅ Valid input - customGrams updated to:", value);

        // Phase 1: Mark that user made a change
        hasUserChangesRef.current = true;
        
        // Reset correction saved flag to allow saving the new quantity
        correctionSavedRef.current = false;

        const gramsValue = parseFloat(value);
        debugLog("   - Parsed gramsValue:", gramsValue, "(Type:", typeof gramsValue, ")");

        if (!isNaN(gramsValue) && servingOptions.length > 0) {
          // Check if grams exactly match any serving option (within 1g tolerance)
          const exactMatchIndex = servingOptions.findIndex(
            (opt) => Math.abs(opt.grams - gramsValue) < 1,
          );

          if (exactMatchIndex !== -1) {
            // Exact match found - update serving display to match
            setCurrentServing(servingOptions[exactMatchIndex]);
            setCurrentServingIndex(exactMatchIndex);
            debugLog("   🎯 Exact match found at index:", exactMatchIndex);
            debugLog("      - Serving:", servingOptions[exactMatchIndex].description);
          } else {
            // Find closest serving option for display only
            // IMPORTANT: Never override customGrams - let user type any value
            const closestIndex = servingOptions.reduce(
              (closestIdx, opt, idx) => {
                const currentDiff = Math.abs(
                  servingOptions[closestIdx].grams - gramsValue,
                );
                const newDiff = Math.abs(opt.grams - gramsValue);
                return newDiff < currentDiff ? idx : closestIdx;
              },
              0,
            );

            setCurrentServing(servingOptions[closestIndex]);
            setCurrentServingIndex(closestIndex);
            debugLog("   ðŸ” Closest match at index:", closestIndex);
            debugLog("      - Serving:", servingOptions[closestIndex].description);
            // customGrams is already set above - don't override it
          }
        } else {
          debugLog("   âš ï¸ No valid gramsValue or no serving options available");
        }
      } else {
        debugLog("   âŒ Invalid input - not updating customGrams");
      }
    };

    // Save food correction with final nutrition data via the pure planner.
    const saveCorrectionIfNeeded = async (updatedFood) => {
      if (correctionSavedRef.current) return;

      const plan = planFoodCorrection({
        originalFoodSnapshot: originalFoodRef.current,
        foodItem,
        updatedFood,
      });
      if (!plan) return;

      const userId = userIdRef.current || user?.id;
      if (!userId) {
        console.warn("[CORRECTION DEBUG] No userId available for saving correction");
        return;
      }

      try {
        const response = await saveFoodCorrection(
          userId,
          plan.aiDetectedName,
          plan.userCorrectedName,
          plan.correctedData,
        );
        if (response?.success) {
          correctionSavedRef.current = true;
          getUserContext(userId).catch(() => {});
        }
      } catch (error) {
        console.error("[CORRECTION DEBUG] Failed to save correction:", error);
      }
    };

    // Auto-save changes (keeps edit mode open) with retry logic
    const handleAutoSave = async (
      overrideFood = null,
      overrideGrams = null,
      overrideServingDesc = null,
      currentRetry = 0,
    ) => {
      const gramsToUse = overrideGrams || customGrams;

      debugLog("\n💾 [GRAM/ML DEBUG] handleAutoSave called:");
      debugLog("   - overrideGrams:", overrideGrams);
      debugLog("   - customGrams:", customGrams);
      debugLog("   - gramsToUse:", gramsToUse);

      if (!gramsToUse) {
        debugLog("   âŒ No grams to use - aborting save");
        return;
      }

      const grams = parseFloat(gramsToUse);
      debugLog("   - Parsed grams:", grams, "(Type:", typeof grams, ")");
      
      if (isNaN(grams) || grams <= 0) {
        debugLog("   âŒ Invalid grams value - aborting save");
        return;
      }

      // Use override food (for instant saves) or selected food or current food item
      let foodToSave = overrideFood || selectedFood;
      
      // If no override or selected food, create fallback from current foodItem
      if (!foodToSave) {
        // Calculate per100g if missing (needed for foods from auto-correction)
        const nutritionData = foodItem.nutrition || foodItem;
        const currentGrams = parseFloat(
          foodItem.serving?.grams || foodItem.grams || foodItem.estimatedWeight
        ) || 100;
        
        const per100gCalculated = foodItem.per100g || {
          calories: (nutritionData.calories || 0) * (100 / currentGrams),
          protein: (nutritionData.protein || 0) * (100 / currentGrams),
          carbs: (nutritionData.carbs || 0) * (100 / currentGrams),
          fat: (nutritionData.fat || 0) * (100 / currentGrams),
          fiber: (nutritionData.fiber || 0) * (100 / currentGrams),
        };
        
        foodToSave = {
          name: foodItem.name,
          category: foodItem.category,
          per100g: per100gCalculated,
          isLiquid: foodItem.isLiquid || false,
        };
      }

      debugLog("   - foodToSave.name:", foodToSave.name);
      debugLog("   - foodToSave.isLiquid:", foodToSave.isLiquid);
      debugLog("   - foodToSave.per100g:", foodToSave.per100g);

      // Validate per100g exists
      if (!foodToSave.per100g) {
        console.error("âŒ Cannot save: per100g data missing", foodToSave);
        setSyncStatus("error");
        return;
      }

      // Calculate final nutrition
      const nutrition = computeNutrition(foodToSave.per100g, grams);
      debugLog("   - Calculated nutrition for", grams, "grams:", nutrition);

      // ✅ Determine unit based on isLiquid flag (prioritize this over stored unit)
      const isLiquid = foodToSave.isLiquid || false;
      const unit = isLiquid ? "ml" : "g";
      debugLog("   - Determined unit:", unit, "(isLiquid:", isLiquid, ")");
      
      // 🔄 REVERSAL DETECTION:
      // If the user has edited the food name back to the ORIGINAL AI-detected
      // name, treat this entry as a reversal of the auto-correction. The
      // global/personal correction in the DB stays intact (other entries /
      // other users keep getting auto-corrected) — but THIS entry must NOT
      // show the "AUTO-CORRECTED" badge anymore.
      const editedNameNorm = (foodToSave.name || '').trim().toLowerCase();
      const originalAiNorm = (foodItem.originalAiName || '').trim().toLowerCase();
      const isAutoCorrectionReversal =
        !!foodItem.wasAutoCorrected &&
        !!originalAiNorm &&
        editedNameNorm === originalAiNorm;

      if (isAutoCorrectionReversal) {
        debugLog(
          `🔁 [REVERSAL] User reverted auto-correction back to original AI name "${foodItem.originalAiName}" — clearing wasAutoCorrected for this entry`,
        );
      }

      const updatedFood = {
        name: foodToSave.name,
        category: foodToSave.category,
        serving: {
          description:
            overrideServingDesc ||
            currentServing?.description ||
            `${grams}${unit}`,
          grams: grams,
          unit: unit,
          isLiquid: isLiquid,
        },
        grams: grams,
        unit: unit,
        isLiquid: isLiquid,
        nutrition: nutrition,
        per100g: foodToSave.per100g,
        // 🔴 CRITICAL: Preserve originalAiName and correction metadata
        // (Cleared only when the user has reverted to the original AI name.)
        originalAiName: isAutoCorrectionReversal
          ? null
          : (foodItem.originalAiName || foodItem.name),
        wasAutoCorrected: isAutoCorrectionReversal
          ? false
          : (foodItem.wasAutoCorrected || false),
        correctionSource: isAutoCorrectionReversal
          ? null
          : (foodItem.correctionSource || null),
        correctionMetadata: isAutoCorrectionReversal
          ? null
          : (foodItem.correctionMetadata || null),
      };

      debugLog("\n📦 [GRAM/ML DEBUG] Final updatedFood object:");
      debugLog("   - updatedFood.grams:", updatedFood.grams);
      debugLog("   - updatedFood.unit:", updatedFood.unit);
      debugLog("   - updatedFood.isLiquid:", updatedFood.isLiquid);
      debugLog("   - updatedFood.serving.grams:", updatedFood.serving.grams);
      debugLog("   - updatedFood.serving.unit:", updatedFood.serving.unit);
      debugLog("   - updatedFood.serving.isLiquid:", updatedFood.serving.isLiquid);
      debugLog("   - updatedFood.serving.description:", updatedFood.serving.description);
      debugLog("   - updatedFood.nutrition:", updatedFood.nutrition);

      try {
        // Phase 7: Cancel any pending save request
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        // Phase 5: Set saving status (prevents closing during save)
        setSyncStatus(currentRetry > 0 ? "retrying" : "saving");

        // Phase 5: Add timeout wrapper for API call (10 seconds max)
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Request timeout")), 10000),
        );

        await Promise.race([onUpdate(index, updatedFood), timeoutPromise]);

        // Success - now save the correction with final nutrition data
        await saveCorrectionIfNeeded(updatedFood);

        // Success - reset retry count and show saved status
        setRetryCount(0);
        setSyncStatus("saved");

        if (syncStatusTimeoutRef.current) {
          clearTimeout(syncStatusTimeoutRef.current);
        }

        syncStatusTimeoutRef.current = setTimeout(() => {
          setSyncStatus("idle");
        }, 1500);
      } catch (error) {
        console.error(
          `âŒ Auto-save failed (attempt ${currentRetry + 1}/${maxRetries}):`,
          error,
        );

        // Phase 5: Auto-retry with exponential backoff
        if (currentRetry < maxRetries - 1) {
          const retryDelay = Math.pow(2, currentRetry) * 1000; // 1s, 2s, 4s
          setRetryCount(currentRetry + 1);
          setSyncStatus("retrying");

          // Clear any existing retry timeout
          if (retryTimeoutRef.current) {
            clearTimeout(retryTimeoutRef.current);
          }

          retryTimeoutRef.current = setTimeout(() => {
            handleAutoSave(
              overrideFood,
              overrideGrams,
              overrideServingDesc,
              currentRetry + 1,
            );
          }, retryDelay);
        } else {
          // Max retries reached - show persistent error
          setRetryCount(0);
          setSyncStatus("error");
          // Don't auto-hide error - let user see it and manually retry
        }
      }
    };

    // Phase 5: Manual retry function
    const handleManualRetry = () => {
      setRetryCount(0);
      setSyncStatus("retrying"); // Set to retrying state to block modal close
      handleAutoSave(); // This will handle the save and update status accordingly
    };

    // Close edit mode - SAVE FIRST, then close
    const handleDone = async () => {
      debugLog("\n🔒 [CLOSE EDIT] User clicked Close Edit button");
      
      // Check if there are unsaved changes
      if (hasUserChangesRef.current && customGrams) {
        debugLog("   💾 Unsaved changes detected - saving now...");
        
        // Save the changes before closing
        try {
          await handleAutoSave();
          debugLog("   ✅ Save completed successfully");
        } catch (error) {
          console.error("   âŒ Save failed:", error);
          // Don't close if save failed - let user see error and retry
          return;
        }
      } else {
        debugLog("   â­ï¸ No unsaved changes - closing immediately");
      }
      
      // Clear any pending auto-save timers
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      if (syncStatusTimeoutRef.current) {
        clearTimeout(syncStatusTimeoutRef.current);
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }

      // Phase 7: Cancel any pending API request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }

      // Reset change tracking
      hasUserChangesRef.current = false;
      isInstantSavingRef.current = false;
      correctionSavedRef.current = false; // Reset for next edit
      setRetryCount(0);

      // Exit edit mode
      setIsEditing(false);
      setSearchQuery("");
      setSearchResults([]);
      setSearchError(null);
      setSelectedFood(null);
      setServingOptions([]);
      setSyncStatus("idle");

      // Notify parent if callback provided
      if (onSave) {
        onSave(index);
      }
      
      debugLog("   🚪 Modal closed\n");
    };
    
    // Assign to ref for useImperativeHandle
    handleDoneRef.current = handleDone;

    // Cancel editing
    const handleCancel = () => {
      // Phase 1: Clear auto-save timer when canceling
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }

      // Phase 5: Clear retry timeout
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }

      // Phase 1: Reset change tracking
      hasUserChangesRef.current = false;
      correctionSavedRef.current = false; // Reset on cancel
      setRetryCount(0);

      setIsEditing(false);
      setSearchQuery("");
      setSearchResults([]);
      setSearchError(null);
      setSelectedFood(null);
      setServingOptions([]);
      setCustomGrams(foodItem.serving?.grams || foodItem.grams || "");

      // Notify parent if callback provided
      if (onCancel) {
        onCancel(index);
      }
    };
    
    // Assign to ref for useImperativeHandle
    handleCancelRef.current = handleCancel;

    // Enter edit mode
    const handleEdit = () => {
      setIsEditing(true);

      // Phase 1: Reset change tracking when entering edit mode
      hasUserChangesRef.current = false;
      correctionSavedRef.current = false; // Reset to allow saving corrections again

      // ✅ CRITICAL: Capture original values FIRST before any modifications
      const originalGrams = foodItem.serving?.grams || foodItem.grams || foodItem.estimatedWeight || 100;
      const originalUnit = foodItem.unit || foodItem.serving?.unit || 'g';
      
      // Capture originalAiName
      let originalAiName = 
        foodItem.originalAiName || 
        foodItem.correctionMetadata?.aiDetected ||
        foodItem.name;
      
      originalFoodRef.current = { 
        ...foodItem,
        name: foodItem.name,
        originalAiName: originalAiName,
        wasAutoCorrected: foodItem.wasAutoCorrected || false,
        correctionSource: foodItem.correctionSource || null,
        grams: originalGrams,
        unit: originalUnit,
      };
      
      debugLog("ðŸ” [EDIT MODE] Captured original values:", {
        name: originalFoodRef.current.name,
        grams: originalFoodRef.current.grams,
        unit: originalFoodRef.current.unit,
        originalAiName: originalFoodRef.current.originalAiName,
      });

      // Debug: Log foodItem to see what data we have
      debugLog("ðŸ” [EditableFoodItem] handleEdit - foodItem:", {
        name: foodItem.name,
        unit: foodItem.unit,
        isLiquid: foodItem.isLiquid,
        servingUnit: foodItem.serving?.unit,
        servingIsLiquid: foodItem.serving?.isLiquid,
        grams: foodItem.grams,
        hasNutrition: !!foodItem.nutrition,
      });

      // Pre-fill with current food data - ensure we have a valid number
      const currentGrams =
        parseFloat(
          foodItem.serving?.grams || foodItem.grams || foodItem.estimatedWeight,
        ) || 100;
      setCustomGrams(currentGrams.toString());
      setSearchQuery(foodItem.name || "");

      // Get nutrition values - check both nested and flat structures
      const nutritionData = foodItem.nutrition || foodItem;
      const currentCalories = nutritionData.calories || 0;
      const currentProtein = nutritionData.protein || 0;
      const currentCarbs = nutritionData.carbs || 0;
      const currentFat = nutritionData.fat || 0;
      const currentFiber = nutritionData.fiber || 0;

      // Calculate per100g values or use existing
      const per100gValues = foodItem.per100g || {
        calories: (currentCalories * 100) / currentGrams, // Keep precise value, don't round
        protein: (currentProtein * 100) / currentGrams,
        carbs: (currentCarbs * 100) / currentGrams,
        fat: (currentFat * 100) / currentGrams,
        fiber: (currentFiber * 100) / currentGrams,
      };

      // Get unit from foodItem
      const itemUnit =
        foodItem.unit ||
        foodItem.serving?.unit ||
        (foodItem.isLiquid || foodItem.serving?.isLiquid ? "ml" : "g");
      const portionDesc =
        foodItem.serving?.description ||
        foodItem.portionDescription ||
        `${currentGrams}${itemUnit}`;

      // Create base serving
      const baseServing = {
        description: portionDesc,
        grams: currentGrams,
        nutrition: {
          calories: currentCalories,
          protein: currentProtein,
          carbs: currentCarbs,
          fat: currentFat,
          fiber: currentFiber,
        },
      };

      // Generate dynamic serving options based on detected quantity
      const dynamicOptions = generateServingOptions(
        baseServing,
        per100gValues,
        foodItem.name,
        portionDesc,
      );

      // Create a mock selected food from current item for editing
      const mockFood = {
        name: foodItem.name,
        category: foodItem.category || "Food",
        unit: foodItem.unit || foodItem.serving?.unit || "g",
        isLiquid: foodItem.isLiquid || foodItem.serving?.isLiquid || false,
        per100g: per100gValues,
        defaultServing: baseServing,
        servingOptions: dynamicOptions.slice(1), // Exclude first option as it's the default
      };

      setSelectedFood(mockFood);
      setServingOptions(dynamicOptions); // Use all dynamic options including the original

      // Find and set the original serving as current
      const originalIndex = dynamicOptions.findIndex((opt) => opt.isOriginal);
      const originalServing =
        originalIndex !== -1
          ? dynamicOptions[originalIndex]
          : dynamicOptions[0];
      const originalIndexFinal = originalIndex !== -1 ? originalIndex : 0;

      setCurrentServing(originalServing);
      setCurrentServingIndex(originalIndexFinal);

      // Note: originalFoodRef.current is already set at the start of handleEdit
    };

    // Display mode
    if (!isEditing) {
      const displayGrams =
        foodItem.serving?.grams ||  
        foodItem.grams ||
        foodItem.estimatedWeight ||
        "";
      const isLiquid = foodItem.isLiquid || foodItem.serving?.isLiquid || false;
      const unit = isLiquid ? "ml" : "g";

      let servingDesc =
        foodItem.serving?.description || foodItem.portionDescription || "";

      // If servingDesc is just a number, construct a proper description
      if (servingDesc && /^\d+$/.test(servingDesc.trim())) {
        // Just a number like "3", add the food name or "pieces"
        const itemName = foodItem.name.toLowerCase();
        servingDesc = `${servingDesc} ${itemName}`;
      }

      return (
        <div className="flex items-start sm:items-center justify-between py-2.5 px-3 gap-4 hover:bg-gray-50 rounded-lg transition-colors border-b border-gray-100 last:border-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 mb-1 flex-wrap">
              <span className="font-medium text-gray-900 text-base">
                {foodItem.name}
              </span>
              {/* 🎯 GLOBAL AUTO-CORRECTION BADGE
                  Hidden when the current name matches originalAiName — that
                  means the user has reverted the auto-correction. */}
              {foodItem.wasAutoCorrected &&
                (foodItem.name || '').trim().toLowerCase() !==
                  (foodItem.originalAiName || '').trim().toLowerCase() && (
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 border border-green-200"
                  title={`Auto-corrected from "${foodItem.originalAiName}" · ${foodItem.correctionSource}`}
                >
                  ✓ Auto {foodItem.correctionMetadata?.userCount && `(${foodItem.correctionMetadata.userCount})`}
                </span>
              )}
              {servingDesc && (
                <span className="text-sm text-gray-600">{servingDesc}</span>
              )}
              {displayGrams && (
                <span className="text-xs text-gray-500">
                  ({displayGrams}
                  {unit})
                </span>
              )}
            </div>
            <div className="text-xs text-gray-600">
              <span className="font-bold text-orange-600 text-sm">
                {foodItem.nutrition?.calories || foodItem.calories || 0}
              </span>{" "}
              <span className="text-orange-600">kcal</span> · Protein{" "}
              {foodItem.nutrition?.protein || foodItem.protein || 0}g · Carbs{" "}
              {foodItem.nutrition?.carbs || foodItem.carbs || 0}g · Fiber{" "}
              {foodItem.nutrition?.fiber || foodItem.fiber || 0}g · Fat{" "}
              {foodItem.nutrition?.fat || foodItem.fat || 0}g
            </div>
            <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap items-center gap-x-2">
              <span>Sugar {foodItem.nutrition?.sugar ?? foodItem.sugar ?? 0}g</span>
              <span>· Sodium {foodItem.nutrition?.sodium ?? foodItem.sodium ?? 0}mg</span>
              <span>· Cholesterol {foodItem.nutrition?.cholesterol ?? foodItem.cholesterol ?? 0}mg</span>
              {(() => {
                const gi = foodItem.nutrition?.glycemic_index ?? foodItem.glycemic_index ?? null;
                if (gi == null) return null;
                const tone = gi <= 55
                  ? 'bg-green-100 text-green-700'
                  : gi <= 69 ? 'bg-amber-100 text-amber-700'
                  : 'bg-red-100 text-red-700';
                const label = gi <= 55 ? 'Low' : gi <= 69 ? 'Mid' : 'High';
                return (
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${tone}`}>
                    GI {gi} · {label}
                  </span>
                );
              })()}
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            {isDeletePending ? (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">
                <div className="flex items-center gap-1.5">
                  <div className="min-w-[86px]">
                    <span className="text-xs text-amber-700 font-medium block leading-none">
                      Deleting in {deleteCountdown}s
                    </span>
                    <span className="mt-1 block h-0.5 w-full rounded-full bg-amber-200 overflow-hidden">
                      <span
                        key={deleteAnimKey}
                        className="block h-full bg-amber-600"
                        style={{
                          transformOrigin: "left",
                          animation: `countdown-shrink ${DELETE_UNDO_SECONDS}s linear forwards`,
                        }}
                      />
                    </span>
                  </div>
                </div>
                <TouchFeedbackButton
                  onClick={handleUndoDelete}
                  className="px-2 py-1 text-xs font-medium rounded-md transition-colors border text-amber-700 hover:text-amber-800 hover:bg-amber-100 border-amber-300"
                  ariaLabel="Undo delete"
                >
                  <span>Undo</span>
                </TouchFeedbackButton>
              </div>
            ) : (
              <>
                <TouchFeedbackButton
                  onClick={handleDelete}
                  disabled={disabled}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 border ${
                    disabled
                      ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                      : "text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                  }`}
                  ariaLabel="Delete food item"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Delete</span>
                </TouchFeedbackButton>
                

                <TouchFeedbackButton
                  onClick={handleEdit}
                  disabled={disabled}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 border ${
                    disabled
                      ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                      : "text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200"
                  }`}
                  ariaLabel="Edit food item"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Edit</span>
                </TouchFeedbackButton>
              </>
            )}
          </div>
          <style>{`@keyframes countdown-shrink { from { transform: scaleX(1); } to { transform: scaleX(0); } }`}</style>
        </div>
      );
    }

    // Edit mode
    return (
      <div
        className={`
      bg-blue-50/50 rounded-lg p-3 space-y-3 border-2 transition-all duration-300
      ${
        syncStatus === "saved"
          ? "border-blue-200 glow-green-pulse"
          : "border-blue-200"
      }
      ${syncStatus === "error" ? "border-red-400" : ""}
      ${syncStatus === "retrying" ? "border-orange-400" : ""}
    `}
      >
        {/* Search Input with Sync Status */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">
            <div className="flex items-center justify-between gap-2 w-full">
              <div className="flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-gray-500" />
                <span>Search Food</span>
              </div>

              {/* Phase 3 & 5: Sync Status Indicator - Top Right */}
              {syncStatus !== "idle" && (
                <div
                  className="flex items-center gap-1.5 text-xs font-medium whitespace-nowrap"
                  role="status"
                  aria-live="polite"
                >
                  {syncStatus === "retrying" && (
                    <>
                      <div
                        className="w-3 h-3 border-2 border-orange-600 border-t-transparent rounded-full animate-spin flex-shrink-0"
                        aria-hidden="true"
                      />
                      <span className="text-orange-700">
                        Retrying... ({retryCount}/{maxRetries})
                      </span>
                      <span className="sr-only">
                        Retrying save, attempt {retryCount} of {maxRetries}
                      </span>
                    </>
                  )}
                  {syncStatus === "saved" && (
                    <>
                      <svg
                        className="w-3.5 h-3.5 text-green-600 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2.5}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      <span className="text-green-700">Saved</span>
                      <span className="sr-only">
                        Changes saved successfully
                      </span>
                    </>
                  )}
                  {syncStatus === "error" && (
                    <>
                      <svg
                        className="w-4 h-4 text-red-600 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                      </svg>
                      <span className="text-red-700 font-medium">
                        Save Failed
                      </span>
                      <span className="sr-only">
                        Error saving changes. Use the retry button to try again.
                      </span>
                      <button
                        onClick={handleManualRetry}
                        aria-label="Retry saving changes"
                        className="ml-2 px-2.5 py-0.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded transition-colors flex items-center gap-1"
                      >
                        <svg
                          className="w-3 h-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                          />
                        </svg>
                        Retry
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchInput}
              onContextMenu={(e) => e.preventDefault()}
              onFocus={(e) => {
                // Scroll input into view when keyboard appears on mobile
                setTimeout(() => {
                  e.target.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                  });
                }, 300);
              }}
              placeholder="Search to replace..."
              className="w-full pl-9 pr-8 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSearchResults([]);
                  setSearchError(null);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Search Results Count */}
          {searchResults.length > 0 &&
            !isSearching &&
            !searchError &&
            searchQuery !== foodItem.name && (
              <div className="mt-1.5 px-1">
                <div className="inline-flex items-center gap-1.5 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                  <Search className="w-3 h-3" />
                  <span>
                    {searchResults.length} alternative
                    {searchResults.length > 1 ? "s" : ""} found
                  </span>
                </div>
              </div>
            )}

          {/* Search Error Message */}
          {searchError && !isSearching && (
            <div className="mt-1.5 px-1">
              <div className="inline-flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                <span>{searchError}</span>
              </div>
            </div>
          )}
        </div>

        {/* Skeleton Loading for Search */}
        {isSearching && (
          <div className="space-y-2 border border-gray-200 rounded-lg bg-white p-3 animate-pulse">
            {[1, 2].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded w-3/4 animate-shimmer bg-[length:200%_100%]"></div>
                <div className="flex items-center gap-2">
                  <div className="h-5 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded w-16 animate-shimmer bg-[length:200%_100%]"></div>
                  <div className="h-5 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded w-12 animate-shimmer bg-[length:200%_100%]"></div>
                  <div className="h-5 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded w-24 animate-shimmer bg-[length:200%_100%]"></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Search Results Dropdown */}
        {searchResults.length > 0 &&
          !isSearching &&
          searchQuery !== foodItem.name && (
            <div className="max-h-48 overflow-y-auto border border-gray-300 rounded-lg bg-white shadow-sm">
              {searchResults.map((food, idx) => (
                <button
                  key={idx}
                  onClick={() => handleFoodSelect(food)}
                  className="w-full text-left px-3 py-2.5 hover:bg-blue-50 active:bg-blue-100 transition-all duration-150 border-b last:border-b-0 text-sm group"
                >
                  <div className="font-medium text-gray-900 mb-1 group-hover:text-blue-700 transition-colors">
                    {food.name}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <span className="bg-gray-100 group-hover:bg-blue-100 px-2 py-0.5 rounded transition-colors">
                      {food.category}
                    </span>
                    <span className="text-red-600 flex items-center gap-1 font-medium">
                      <Flame className="w-3 h-3" />
                      {food.defaultServing.nutrition.calories}
                    </span>
                    <span className="text-gray-500">
                      / {food.defaultServing.description}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}

        {/* Serving Size and Grams Controls - Always visible in edit mode */}
        <div className="space-y-2.5">
          {/* Serving Size Dropdown - DISABLED (save on Done button instead) */}

          {/* Custom Grams/ML Input - Always visible */}
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
              <BathroomScaleIcon className="w-3.5 h-3.5 text-gray-500" />
              <span>{selectedFood?.isLiquid ? "Volume" : "Weight"}</span>
            </label>
            <div className="relative">
              <input
                type="text"
                inputMode="decimal"
                pattern="[0-9]*\.?[0-9]*"
                value={customGrams}
                onChange={handleGramsChange}
                onPaste={(e) => {
                  e.preventDefault();
                  const pastedText = e.clipboardData.getData('text');
                  const sanitized = pastedText.replace(/[^0-9.]/g, '');
                  e.target.value = sanitized;
                  handleGramsChange(e);
                }}
                onContextMenu={(e) => e.preventDefault()}
                placeholder={
                  selectedFood?.isLiquid ? "Enter ml" : "Enter grams"
                }
                className="w-full px-3 py-2 pr-10 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
                {selectedFood?.isLiquid ? "ml" : "g"}
              </span>
            </div>
          </div>

          {/* Nutrition Preview - Glassmorphism Pills */}
          {customGrams && selectedFood && selectedFood.per100g && (
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
                <Utensils className="w-3.5 h-3.5 text-gray-500" />
                <span>
                  Preview ({customGrams}
                  {selectedFood?.isLiquid ? "ml" : "g"})
                </span>
              </label>
              {(() => {
                const nutrition = computeNutrition(
                  selectedFood.per100g,
                  parseFloat(customGrams),
                );
                return nutrition ? (
                  <div className="flex flex-wrap justify-start gap-1.5 sm:gap-2">
                    {/* Calories Pill - Glassmorphism */}
                    <div className="flex items-center justify-center gap-1.5 sm:gap-2 min-h-[40px] sm:min-h-[44px] bg-red-50/80 backdrop-blur-sm border border-red-200/50 rounded-full px-2.5 sm:px-3 py-2 sm:py-2.5 flex-shrink-0">
                      <Flame className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-600 flex-shrink-0" />
                      <span className="text-xs sm:text-sm font-bold text-red-700 whitespace-nowrap">
                        {nutrition.calories}
                      </span>
                    </div>

                    {/* Protein Pill - Glassmorphism */}
                    <div className="flex items-center justify-center gap-1.5 sm:gap-2 min-h-[40px] sm:min-h-[44px] bg-blue-50/80 backdrop-blur-sm border border-blue-200/50 rounded-full px-2.5 sm:px-3 py-2 sm:py-2.5 flex-shrink-0">
                      <Beef className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 flex-shrink-0" />
                      <span className="text-xs sm:text-sm font-bold text-blue-700 whitespace-nowrap">
                        {nutrition.protein}g
                      </span>
                    </div>

                    {/* Carbs Pill - Glassmorphism */}
                    <div className="flex items-center justify-center gap-1.5 sm:gap-2 min-h-[40px] sm:min-h-[44px] bg-yellow-50/80 backdrop-blur-sm border border-yellow-200/50 rounded-full px-2.5 sm:px-3 py-2 sm:py-2.5 flex-shrink-0">
                      <Wheat className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-yellow-700 flex-shrink-0" />
                      <span className="text-xs sm:text-sm font-bold text-yellow-800 whitespace-nowrap">
                        {nutrition.carbs}g
                      </span>
                    </div>

                    {/* Fat Pill - Glassmorphism */}
                    <div className="flex items-center justify-center gap-1.5 sm:gap-2 min-h-[40px] sm:min-h-[44px] bg-purple-50/80 backdrop-blur-sm border border-purple-200/50 rounded-full px-2.5 sm:px-3 py-2 sm:py-2.5 flex-shrink-0">
                      <Droplet className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-600 flex-shrink-0" />
                      <span className="text-xs sm:text-sm font-bold text-purple-700 whitespace-nowrap">
                        {nutrition.fat}g
                      </span>
                    </div>

                    {/* Fiber Pill - Glassmorphism */}
                    <div className="flex items-center justify-center gap-1.5 sm:gap-2 min-h-[40px] sm:min-h-[44px] bg-green-50/80 backdrop-blur-sm border border-green-200/50 rounded-full px-2.5 sm:px-3 py-2 sm:py-2.5 flex-shrink-0">
                      <Leaf className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-600 flex-shrink-0" />
                      <span className="text-xs sm:text-sm font-bold text-green-700 whitespace-nowrap">
                        {nutrition.fiber}g
                      </span>
                    </div>
                  </div>
                ) : null;
              })()}
            </div>
          )}
        </div>

        {/* Action Buttons - only show if not hidden by parent */}
        {!hideButtons && (
          <button
            onClick={handleDone}
            disabled={syncStatus === "saving" || syncStatus === "retrying"}
            aria-busy={syncStatus === "saving" || syncStatus === "retrying"}
            aria-live="polite"
            className={`w-full rounded-lg text-white text-sm font-medium px-4 py-2.5 shadow-sm hover:shadow-md transition-all ${
              syncStatus === "saving" || syncStatus === "retrying"
                ? "bg-gray-400 cursor-not-allowed opacity-50"
                : "bg-indigo-600 hover:bg-indigo-700"
            }`}
          >
            <div className="flex items-center justify-center gap-2 h-5">
              {syncStatus === "saving" || syncStatus === "retrying" ? (
                <>
                  <div
                    className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"
                    aria-hidden="true"
                  />
                  <span className="inline-block">Saving...</span>
                  <span className="sr-only">Saving changes, please wait</span>
                </>
              ) : (
                <>
                  <X className="w-4 h-4" aria-hidden="true" />
                  <span className="inline-block">Close Edit</span>
                </>
              )}
            </div>
          </button>
        )}
      </div>
    );
  },
);

EditableFoodItem.displayName = "EditableFoodItem";

export default EditableFoodItem;
