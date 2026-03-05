//src\components\NutritionCard.js
import React, { useState, useCallback, useRef, useEffect } from "react";
import { Share2 } from "lucide-react";
import EditableFoodItem from "./EditableFoodItem";
import { getUserId } from "../services/getUserId";
import { geminiService } from "../services/geminiService";
import { captureAndShare } from "../utils/shareUtils";

const NutritionCard = ({
  data,
  onDataUpdate,
  user,
  imagePreview,
  selectedImage,
  savedMealId,
  onClose,
}) => {
  // Local state for editable food items (must be before early return)
  const [localDetailedItems, setLocalDetailedItems] = useState(
    data?.detailedItems || [],
  );
  const [localNutrition, setLocalNutrition] = useState(data?.nutrition || {});
  const [isSaving, setIsSaving] = useState(false);
  const [editingStates, setEditingStates] = useState({});
  const [isSharing, setIsSharing] = useState(false);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemPortion, setNewItemPortion] = useState("");
  const [newItemQuantity, setNewItemQuantity] = useState("100");
  const [newItemUnit, setNewItemUnit] = useState("g");
  const [addItemError, setAddItemError] = useState("");
  const [addSearchResults, setAddSearchResults] = useState([]);
  const [isAddSearching, setIsAddSearching] = useState(false);
  const [showAddSuggestions, setShowAddSuggestions] = useState(false);
  const [selectedAddFood, setSelectedAddFood] = useState(null);
  const [activeAddSuggestionIndex, setActiveAddSuggestionIndex] = useState(-1);
  const cardRef = useRef(null);
  const shareRef = useRef(null);
  const addSearchTimeoutRef = useRef(null);

  // Sync local state when data prop changes (e.g., after correction is applied)
  useEffect(() => {
    console.log('🔄 [NutritionCard] Data prop changed, syncing local state');
    console.log('   New nutrition values:', data?.nutrition);
    console.log('   New detailedItems count:', data?.detailedItems?.length);
    
    if (data?.nutrition) {
      setLocalNutrition(data.nutrition);
    }
    if (data?.detailedItems) {
      setLocalDetailedItems(data.detailedItems);
    }
  }, [data?.nutrition, data?.detailedItems]);

  // Handle editing state change from EditableFoodItem - wrapped in useCallback to prevent re-creation
  const handleEditingChange = useCallback(
    (index, isItemEditing, isBlocking = false) => {
      setEditingStates((prev) => ({
        ...prev,
        [index]: isItemEditing,
      }));

      // Track if any item is actively saving/retrying (blocks actions)
      setIsSaving(isBlocking);
    },
    [],
  );

  // Derive editing index from editing states
  const editingIndex = Object.keys(editingStates).find(
    (key) => editingStates[key],
  )
    ? parseInt(Object.keys(editingStates).find((key) => editingStates[key]))
    : null;

  // Generate meal name from food items
  const generateMealName = () => {
    if (localDetailedItems.length === 0) return data?.category?.name || "Meal";
    if (localDetailedItems.length === 1) return localDetailedItems[0].name;

    const firstItem = localDetailedItems[0].name;
    const remaining = localDetailedItems.length - 1;
    return `${firstItem} + ${remaining} more`;
  };

  // Recalculate total nutrition from all food items
  const recalculateTotals = (items) => {
    console.log('🧮 [NutritionCard] recalculateTotals - Processing items:', items.length);
    
    const totals = items.reduce(
      (acc, item, index) => {
        const itemCalories = item.nutrition?.calories || item.calories || 0;
        const itemProtein = item.nutrition?.protein || item.protein || 0;
        const itemCarbs = item.nutrition?.carbs || item.carbs || 0;
        const itemFat = item.nutrition?.fat || item.fat || 0;
        const itemFiber = item.nutrition?.fiber || item.fiber || 0;
        
        console.log(`   📊 Item ${index + 1}: ${item.name}`);
        console.log(`      - calories: nutrition=${item.nutrition?.calories}, top-level=${item.calories}, using=${itemCalories}`);
        console.log(`      - carbs: nutrition=${item.nutrition?.carbs}, top-level=${item.carbs}, using=${itemCarbs}`);
        console.log(`      - protein: nutrition=${item.nutrition?.protein}, top-level=${item.protein}, using=${itemProtein}`);
        
        return {
          calories: acc.calories + itemCalories,
          protein: acc.protein + itemProtein,
          carbs: acc.carbs + itemCarbs,
          fat: acc.fat + itemFat,
          fiber: acc.fiber + itemFiber,
        };
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
    );

    // Round to 1 decimal
    const rounded = {
      calories: Math.round(totals.calories),
      protein: Math.round(totals.protein * 10) / 10,
      carbs: Math.round(totals.carbs * 10) / 10,
      fat: Math.round(totals.fat * 10) / 10,
      fiber: Math.round(totals.fiber * 10) / 10,
    };
    
    console.log('   ✅ Final totals:', rounded);
    return rounded;
  };

  const updateLocalAndParentState = (newItems, newTotals) => {
    setLocalDetailedItems(newItems);
    setLocalNutrition(newTotals);

    if (typeof onDataUpdate === "function") {
      onDataUpdate({
        ...data,
        nutrition: newTotals,
        detailedItems: newItems,
        itemCount: newItems.length,
      });
    }
  };

  const resetAddItemForm = () => {
    setIsAddingItem(false);
    setNewItemName("");
    setNewItemPortion("");
    setNewItemQuantity("100");
    setNewItemUnit("g");
    setAddItemError("");
    setAddSearchResults([]);
    setIsAddSearching(false);
    setShowAddSuggestions(false);
    setSelectedAddFood(null);
    setActiveAddSuggestionIndex(-1);
    if (addSearchTimeoutRef.current) {
      clearTimeout(addSearchTimeoutRef.current);
      addSearchTimeoutRef.current = null;
    }
  };

  const handleAddNameChange = (value) => {
    setNewItemName(value);
    setAddItemError("");
    setSelectedAddFood(null);
    setShowAddSuggestions(true);
    setActiveAddSuggestionIndex(-1);
  };

  const handleSelectAddSuggestion = (food) => {
    setSelectedAddFood(food);
    setNewItemName(food.name || "");

    const defaultGrams = Number(food?.defaultServing?.grams || 100);
    const isLiquid = food?.isLiquid || food?.unit === "ml";
    setNewItemQuantity(String(Math.round(defaultGrams)));
    setNewItemUnit(isLiquid ? "ml" : "g");
    // setNewItemPortion(food?.defaultServing?.description || "");

    setShowAddSuggestions(false);
    setActiveAddSuggestionIndex(-1);
  };

  useEffect(() => {
    if (!isAddingItem) return;

    const query = newItemName.trim();
    if (addSearchTimeoutRef.current) {
      clearTimeout(addSearchTimeoutRef.current);
      addSearchTimeoutRef.current = null;
    }

    if (query.length < 1) {
      setAddSearchResults([]);
      setIsAddSearching(false);
      return;
    }

    const cached = geminiService.getCachedSearch(query);
    if (cached?.results?.length) {
      setAddSearchResults(cached.results);
    }

    setIsAddSearching(true);
    addSearchTimeoutRef.current = setTimeout(async () => {
      try {
        const searchRes = await geminiService.searchFood(query);
        setAddSearchResults(searchRes?.results || []);
      } catch (error) {
        console.error("[NutritionCard] Add-item suggestion search failed:", error);
      } finally {
        setIsAddSearching(false);
      }
    }, 250);

    return () => {
      if (addSearchTimeoutRef.current) {
        clearTimeout(addSearchTimeoutRef.current);
        addSearchTimeoutRef.current = null;
      }
    };
  }, [newItemName, isAddingItem]);

  const handleAddNameKeyDown = (e) => {
    if (!showAddSuggestions || addSearchResults.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveAddSuggestionIndex((prev) =>
        prev < addSearchResults.length - 1 ? prev + 1 : 0,
      );
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveAddSuggestionIndex((prev) =>
        prev > 0 ? prev - 1 : addSearchResults.length - 1,
      );
      return;
    }

    if (e.key === "Enter" && activeAddSuggestionIndex >= 0) {
      e.preventDefault();
      const selected = addSearchResults[activeAddSuggestionIndex];
      if (selected) {
        handleSelectAddSuggestion(selected);
      }
      return;
    }

    if (e.key === "Escape") {
      setShowAddSuggestions(false);
      setActiveAddSuggestionIndex(-1);
    }
  };

  const calculateNutritionFromSearchResult = (foodResult, quantity) => {
    if (!foodResult) return null;

    const qty = Number(quantity) || 0;
    if (qty <= 0) return null;

    if (foodResult.per100g) {
      const multiplier = qty / 100;
      return {
        calories: Math.round((foodResult.per100g.calories || 0) * multiplier),
        protein: Math.ceil((foodResult.per100g.protein || 0) * multiplier),
        carbs: Math.ceil((foodResult.per100g.carbs || 0) * multiplier),
        fat: Math.ceil((foodResult.per100g.fat || 0) * multiplier),
        fiber: Math.ceil((foodResult.per100g.fiber || 0) * multiplier),
      };
    }

    const defaultServing = foodResult.defaultServing;
    if (
      defaultServing?.nutrition &&
      defaultServing?.grams &&
      Number(defaultServing.grams) > 0
    ) {
      const multiplier = qty / Number(defaultServing.grams);
      return {
        calories: Math.round((defaultServing.nutrition.calories || 0) * multiplier),
        protein: Math.ceil((defaultServing.nutrition.protein || 0) * multiplier),
        carbs: Math.ceil((defaultServing.nutrition.carbs || 0) * multiplier),
        fat: Math.ceil((defaultServing.nutrition.fat || 0) * multiplier),
        fiber: Math.ceil((defaultServing.nutrition.fiber || 0) * multiplier),
      };
    }

    return null;
  };

  const saveMealUpdate = async (items, totals) => {
    // Phase 5: Auto-save update to backend
    if (!savedMealId) {
      console.warn("⚠️ [NutritionCard] No saved meal ID - skipping auto-save");
      return;
    }

    const apiBaseUrl =
      process.env.REACT_APP_API_BASE_URL || "http://localhost:3000";

    // Get userId - either from user object directly or via lookup
    let userId = user?.id;
    if (!userId) {
      userId = await getUserId(user);
    }

    if (!userId) {
      throw new Error("User not authenticated or not found in database");
    }

    const analysisData = {
      foods: items.map((item) => {
        const actualGrams =
          item.serving?.grams ||
          item.grams ||
          item.weight_g ||
          item.volume_ml ||
          100;
        const isLiquid = item.isLiquid || false;
        const unit = item.unit || (isLiquid ? "ml" : "g");

        return {
          name: item.name,
          originalAiName: item.originalAiName || item.name,
          wasAutoCorrected: item.wasAutoCorrected || false,
          correctionSource: item.correctionSource || null,
          correctionMetadata: item.correctionMetadata || null,
          portion:
            item.serving?.description ||
            item.portionDescription ||
            item.portion ||
            "1 serving",
          weight_g: isLiquid ? null : actualGrams,
          volume_ml: isLiquid ? actualGrams : null,
          grams: actualGrams,
          unit: unit,
          isLiquid: isLiquid,
          nutrition: {
            calories: Math.round(item.nutrition?.calories || item.calories || 0),
            protein: Math.round(item.nutrition?.protein || item.protein || 0),
            carbs: Math.round(item.nutrition?.carbs || item.carbs || 0),
            fat: Math.round(item.nutrition?.fat || item.fat || 0),
            fiber: Math.round(item.nutrition?.fiber || item.fiber || 0),
          },
        };
      }),
      total: {
        calories: Math.round(totals.calories || 0),
        protein: Math.round(totals.protein || 0),
        carbs: Math.round(totals.carbs || 0),
        fat: Math.round(totals.fat || 0),
        fiber: Math.round(totals.fiber || 0),
      },
      confidence: "high",
    };

    const response = await fetch(`${apiBaseUrl}/api/update-nutrition-analysis`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: savedMealId,
        userId: userId,
        analysisData: analysisData,
        totalCalories: Math.round(totals.calories || 0),
        totalProtein: Math.round(totals.protein || 0),
        totalCarbs: Math.round(totals.carbs || 0),
        totalFat: Math.round(totals.fat || 0),
        totalFiber: Math.round(totals.fiber || 0),
      }),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Failed to update meal");
    }
  };

  // Handle food item update with auto-save
  const handleFoodUpdate = async (index, updatedFood) => {
    console.log("[NutritionCard] Updating food item at index:", index);
    console.log("[NutritionCard] Received updatedFood:", {
      name: updatedFood.name,
      grams: updatedFood.grams,
      serving_grams: updatedFood.serving?.grams,
      unit: updatedFood.unit,
      serving_unit: updatedFood.serving?.unit,
    });

    const newItems = [...localDetailedItems];
    newItems[index] = {
      ...newItems[index],
      ...updatedFood,
      // Preserve original fields if not in updatedFood
      calories: updatedFood.nutrition?.calories || updatedFood.calories,
      protein: updatedFood.nutrition?.protein || updatedFood.protein,
      carbs: updatedFood.nutrition?.carbs || updatedFood.carbs,
      fat: updatedFood.nutrition?.fat || updatedFood.fat,
      fiber: updatedFood.nutrition?.fiber || updatedFood.fiber,
    };

    // Recalculate totals
    const newTotals = recalculateTotals(newItems);
    updateLocalAndParentState(newItems, newTotals);

    console.log("[NutritionCard] Updated totals:", newTotals);

    try {
      await saveMealUpdate(newItems, newTotals);
    } catch (error) {
      console.error("[NutritionCard] Auto-save failed:", error);
      // Phase 5: Re-throw error so EditableFoodItem's retry logic can handle it
      throw error;
    }
  };

  const handleAddMissingItem = async () => {
    setAddItemError("");

    const trimmedName = newItemName.trim();
    if (!trimmedName) {
      setAddItemError("Food name is required");
      return;
    }

    const parsedQuantity = parseFloat(newItemQuantity);
    const quantity =
      Number.isFinite(parsedQuantity) && parsedQuantity > 0 ? parsedQuantity : 100;
    const isLiquid = newItemUnit === "ml";
    setIsSaving(true);

    let selectedFoodResult = selectedAddFood;
    let nutritionValues = null;

    if (!selectedFoodResult) {
      try {
        const searchRes = await geminiService.searchFood(trimmedName);
        if (searchRes?.results?.length) {
          const exactMatch = searchRes.results.find(
            (r) => (r.name || "").trim().toLowerCase() === trimmedName.toLowerCase(),
          );
          selectedFoodResult = exactMatch || searchRes.results[0];
        }
      } catch (error) {
        console.error("[NutritionCard] Nutrition lookup failed:", error);
        setAddItemError("Unable to fetch nutrition. Please try again.");
        setIsSaving(false);
        return;
      }
    }

    nutritionValues = calculateNutritionFromSearchResult(
      selectedFoodResult,
      quantity,
    );

    if (!selectedFoodResult || !nutritionValues) {
      setAddItemError("No nutrition data found for this item. Try a specific name.");
      setIsSaving(false);
      return;
    }

    const portionText =
      newItemPortion.trim() ||
      `${Math.round(quantity)}${newItemUnit} ${trimmedName}`.trim();

    const newItem = {
      name: trimmedName,
      originalAiName: trimmedName,
      wasAutoCorrected: false,
      correctionSource: "manual_add",
      correctionMetadata: null,
      portionDescription: portionText,
      estimatedWeight: quantity,
      unit: newItemUnit,
      isLiquid: isLiquid,
      grams: quantity,
      weight_g: isLiquid ? null : quantity,
      volume_ml: isLiquid ? quantity : null,
      serving: {
        description: portionText,
        grams: quantity,
        unit: newItemUnit,
        isLiquid: isLiquid,
      },
      per100g: selectedFoodResult.per100g || null,
      defaultServing: selectedFoodResult.defaultServing || null,
      ...nutritionValues,
      nutrition: nutritionValues,
    };

    const newItems = [...localDetailedItems, newItem];
    const newTotals = recalculateTotals(newItems);
    updateLocalAndParentState(newItems, newTotals);

    try {
      await saveMealUpdate(newItems, newTotals);
      resetAddItemForm();
    } catch (error) {
      console.error("[NutritionCard] Add missing item save failed:", error);
      setAddItemError(error.message || "Failed to save item");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteItem = async (index) => {
    if (index < 0 || index >= localDetailedItems.length) return;

    const previousItems = localDetailedItems;
    const previousTotals = localNutrition;

    const updatedItems = localDetailedItems.filter((_, i) => i !== index);
    const newTotals = recalculateTotals(updatedItems);
    updateLocalAndParentState(updatedItems, newTotals);

    setIsSaving(true);
    try {
      await saveMealUpdate(updatedItems, newTotals);
    } catch (error) {
      console.error("[NutritionCard] Delete item save failed:", error);
      updateLocalAndParentState(previousItems, previousTotals);
      alert("Failed to delete item. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle share button click
  const handleShare = async (e) => {
    // Prevent event propagation and bubbling
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    // Early return if already sharing
    if (isSharing) {
      console.log("⚠️ Share already in progress, ignoring duplicate call");
      return;
    }

    if (!shareRef.current) {
      console.error("Share content not found");
      return;
    }

    setIsSharing(true);
    try {
      const mealName = generateMealName();
      const calories = localNutrition?.calories || 0;

      // Build detailed breakdown text
      let breakdownText = `My ${mealName}\n`;
      breakdownText += `${Math.round(calories)} kcal 🍎\n\n`;

      // Add nutrition summary
      breakdownText += `📊 Nutrition Summary:\n`;
      breakdownText += `• Calories: ${Math.round(
        localNutrition.calories,
      )} kcal\n`;
      breakdownText += `• Protein: ${localNutrition.protein}g\n`;
      breakdownText += `• Carbs: ${localNutrition.carbs}g\n`;
      breakdownText += `• Fat: ${localNutrition.fat}g\n`;
      breakdownText += `• Fiber: ${localNutrition.fiber}g\n\n`;

      // Add food breakdown if multiple items
      if (localDetailedItems.length > 0) {
        breakdownText += `🍽️ Food Breakdown:\n`;
        localDetailedItems.forEach((item, index) => {
          const itemCals = item.nutrition?.calories || item.calories || 0;
          const portion =
            item.serving?.description ||
            item.portionDescription ||
            item.portion ||
            "";
          breakdownText += `${index + 1}. ${item.name}`;
          if (portion) {
            breakdownText += ` (${portion})`;
          }
          breakdownText += `\n   ${Math.round(itemCals)} kcal`;
          breakdownText += ` • Protein: ${Math.round(
            item.nutrition?.protein || item.protein || 0,
          )}g`;
          breakdownText += ` • Carbs: ${Math.round(
            item.nutrition?.carbs || item.carbs || 0,
          )}g`;
          breakdownText += ` • Fat: ${Math.round(
            item.nutrition?.fat || item.fat || 0,
          )}g`;
          if ((item.nutrition?.fiber || item.fiber || 0) > 0) {
            breakdownText += ` • Fiber: ${Math.round(
              item.nutrition?.fiber || item.fiber || 0,
            )}g`;
          }
          breakdownText += `\n`;
        });
        breakdownText += `\n`;
      }

      breakdownText += `Tracked with Wellness Valley 💚`;

      await captureAndShare(shareRef.current, {
        title: `${mealName} - Wellness Valley`,
        text: breakdownText,
        fileName: `wellness-valley-${mealName
          .toLowerCase()
          .replace(/\s+/g, "-")}.png`,
        // whatsappOnly: true, // Explicitly enable WhatsApp sharing
      });
    } catch (error) {
      console.error("❌ Failed to share:", error);
      // Show error to user if it's not a cancellation
      if (!error?.message?.toLowerCase().includes('cancel')) {
        alert('Unable to share. Please check your device settings and permissions.');
      }
    } finally {
      setIsSharing(false);
    }
  };

  // Early return after hooks
  if (!data) return null;

  const {
    nutrition,
    category,
    servingInfo,
    itemCount,
    detailedItems,
    portionAnalysis,
  } = data;
  return (
    <>
      {/* Hidden container for sharing - includes image + card */}
      <div
        ref={shareRef}
        className="fixed -left-[9999px] top-0 w-[400px]"
        style={{ position: "fixed", left: "-9999px" }}
      >
        <div className="bg-white rounded-xl shadow-lg border-2 border-green-300 overflow-hidden">
          {/* Food Image for sharing */}
          {(imagePreview || selectedImage) && (
            <div className="relative">
              <img
                src={imagePreview || selectedImage}
                alt="Food"
                className="w-full h-64 object-cover"
                crossOrigin="anonymous"
              />
            </div>
          )}

          {/* Duplicate card content for sharing */}
          <div className="bg-gradient-to-r from-green-500 to-green-600 text-white p-4">
            <div className="text-center">
              <h2 className="text-xl font-bold">{generateMealName()}</h2>
              {localDetailedItems.length > 1 && (
                <p className="text-green-100 text-sm mt-1">
                  {localDetailedItems.length} food items analyzed
                </p>
              )}
            </div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-gradient-to-br from-red-50 to-red-100 border border-red-200 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-red-600">
                  {localNutrition.calories}
                </div>
                <div className="text-sm font-medium text-red-700 mt-1">
                  Calories
                </div>
              </div>
              <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 border border-yellow-200 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-yellow-600">
                  {localNutrition.carbs}g
                </div>
                <div className="text-sm font-medium text-yellow-700 mt-1">
                  Carbs
                </div>
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-blue-600">
                  {localNutrition.protein}g
                </div>
                <div className="text-sm font-medium text-blue-700 mt-1">
                  Protein
                </div>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-purple-600">
                  {localNutrition.fat}g
                </div>
                <div className="text-sm font-medium text-purple-700 mt-1">
                  Fat
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-xl p-4 text-center mb-4">
              <div className="text-3xl font-bold text-green-600">
                {localNutrition.fiber}g
              </div>
              <div className="text-sm font-medium text-green-700 mt-1">
                Fiber
              </div>
            </div>

            {/* Macronutrient Bar */}
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">
                Macronutrient Distribution
              </h3>
              <div className="flex rounded-lg overflow-hidden h-4 bg-gray-200">
                {(() => {
                  const totalCals =
                    nutrition.carbs * 4 +
                    nutrition.protein * 4 +
                    nutrition.fat * 9;
                  const carbsPct =
                    totalCals > 0
                      ? ((nutrition.carbs * 4) / totalCals) * 100
                      : 0;
                  const proteinPct =
                    totalCals > 0
                      ? ((nutrition.protein * 4) / totalCals) * 100
                      : 0;
                  const fatPct =
                    totalCals > 0 ? ((nutrition.fat * 9) / totalCals) * 100 : 0;
                  return (
                    <>
                      <div
                        className="bg-yellow-400"
                        style={{ width: `${carbsPct}%` }}
                      />
                      <div
                        className="bg-blue-400"
                        style={{ width: `${proteinPct}%` }}
                      />
                      <div
                        className="bg-purple-400"
                        style={{ width: `${fatPct}%` }}
                      />
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Food Breakdown for sharing */}
            {localDetailedItems && localDetailedItems.length > 0 && (
              <div className="mt-6 pt-4 border-t border-gray-200">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">
                  Food Breakdown
                </h3>
                <div className="space-y-3">
                  {localDetailedItems.map((item, index) => {
                    const itemCals = Math.round(
                      item.nutrition?.calories || item.calories || 0,
                    );
                    const portion =
                      item.serving?.description ||
                      item.portionDescription ||
                      item.portion ||
                      "1 serving";
                    const weight =
                      item.serving?.grams || item.grams || item.weight_g || "";

                    return (
                      <div
                        key={index}
                        className="pb-3 border-b border-gray-100 last:border-0"
                      >
                        <div className="flex justify-between items-start mb-1">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900">
                              {item.name}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              {portion} {weight ? `(${weight}g)` : ""}
                            </div>
                          </div>
                          
                          {/* Calories */}
                          <div className="text-base font-bold text-red-600 flex-shrink-0 ml-2">
                            {itemCals} kcal
                          </div>
                        </div>
                        
                        {/* Nutrient breakdown */}
                        <div className="text-[11px] font-medium flex flex-wrap gap-2">
                          <span className="text-blue-600">
                            Protein{" "}
                            {Math.round(
                              item.nutrition?.protein || item.protein || 0,
                            )}g
                          </span>
                          <span className="text-gray-400">•</span>
                          <span className="text-yellow-600">
                            Carbs{" "}
                            {Math.round(item.nutrition?.carbs || item.carbs || 0)}g
                          </span>
                          <span className="text-gray-400">•</span>
                          <span className="text-green-600">
                            Fiber{" "}
                            {Math.round(item.nutrition?.fiber || item.fiber || 0)}g
                          </span>
                          <span className="text-gray-400">•</span>
                          <span className="text-purple-600">
                            Fat{" "}
                            {Math.round(item.nutrition?.fat || item.fat || 0)}g
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Visible card without image */}
      <div
        ref={cardRef}
        className="bg-white rounded-xl shadow-lg border-2 border-green-300 overflow-hidden"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-green-500 to-green-600 text-white p-4 relative">
          <div className="flex items-center justify-center gap-3">
            <div className="flex-1 text-center">
              <h2 className="text-xl font-bold">{generateMealName()}</h2>
              {localDetailedItems.length > 1 && (
                <p className="text-green-100 text-sm mt-1">
                  {localDetailedItems.length} food items analyzed
                </p>
              )}
              {servingInfo && (
                <p className="text-green-100 text-sm">
                  Per {servingInfo.description || "100g"}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Nutrition Grid */}
        <div className="p-6">
          <div className="grid grid-cols-2 gap-3 mb-4">
            {/* Calories */}
            <div className="bg-gradient-to-br from-red-50 to-red-100 border border-red-200 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-red-600">
                {localNutrition.calories}
              </div>
              <div className="text-sm font-medium text-red-700 mt-1">
                Calories
              </div>
            </div>

            {/* Carbs */}
            <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 border border-yellow-200 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-yellow-600">
                {localNutrition.carbs}g
              </div>
              <div className="text-sm font-medium text-yellow-700 mt-1">
                Carbs
              </div>
            </div>

            {/* Protein */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-blue-600">
                {localNutrition.protein}g
              </div>
              <div className="text-sm font-medium text-blue-700 mt-1">
                Protein
              </div>
            </div>

            {/* Fat */}
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-purple-600">
                {localNutrition.fat}g
              </div>
              <div className="text-sm font-medium text-purple-700 mt-1">
                Fat
              </div>
            </div>
          </div>

          {/* Fiber - Full Width */}
          <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-xl p-4 text-center mb-4">
            <div className="text-3xl font-bold text-green-600">
              {localNutrition.fiber}g
            </div>
            <div className="text-sm font-medium text-green-700 mt-1">Fiber</div>
          </div>

          {/* Macronutrient Bar */}
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">
              Macronutrient Distribution
            </h3>
            <div className="flex rounded-lg overflow-hidden h-4 bg-gray-200">
              {(() => {
                const totalCals =
                  nutrition.carbs * 4 +
                  nutrition.protein * 4 +
                  nutrition.fat * 9;
                const carbsPct =
                  totalCals > 0 ? ((nutrition.carbs * 4) / totalCals) * 100 : 0;
                const proteinPct =
                  totalCals > 0
                    ? ((nutrition.protein * 4) / totalCals) * 100
                    : 0;
                const fatPct =
                  totalCals > 0 ? ((nutrition.fat * 9) / totalCals) * 100 : 0;

                return (
                  <>
                    <div
                      className="bg-yellow-400"
                      style={{ width: `${carbsPct}%` }}
                      title={`Carbs: ${carbsPct.toFixed(1)}%`}
                    />
                    <div
                      className="bg-blue-400"
                      style={{ width: `${proteinPct}%` }}
                      title={`Protein: ${proteinPct.toFixed(1)}%`}
                    />
                    <div
                      className="bg-purple-400"
                      style={{ width: `${fatPct}%` }}
                      title={`Fat: ${fatPct.toFixed(1)}%`}
                    />
                  </>
                );
              })()}
            </div>

            {/* Aligned Labels */}
            <div className="relative mt-1">
              {(() => {
                const totalCals =
                  nutrition.carbs * 4 +
                  nutrition.protein * 4 +
                  nutrition.fat * 9;
                const carbsPct =
                  totalCals > 0 ? ((nutrition.carbs * 4) / totalCals) * 100 : 0;
                const proteinPct =
                  totalCals > 0
                    ? ((nutrition.protein * 4) / totalCals) * 100
                    : 0;
                const fatPct =
                  totalCals > 0 ? ((nutrition.fat * 9) / totalCals) * 100 : 0;

                // Calculate center positions of each segment
                const carbsCenter = carbsPct / 2;
                const proteinCenter = carbsPct + proteinPct / 2;
                const fatCenter = carbsPct + proteinPct + fatPct / 2;

                return (
                  <div className="flex relative h-6 text-xs text-gray-600">
                    {/* Carbs Label */}
                    {carbsPct > 0 && (
                      <div
                        className="absolute flex items-center justify-center transform -translate-x-1/2"
                        style={{ left: `${carbsCenter}%` }}
                      >
                        <span className="w-2 h-2 bg-yellow-400 rounded-full mr-1"></span>
                        <span className="whitespace-nowrap">Carbs</span>
                      </div>
                    )}

                    {/* Protein Label */}
                    {proteinPct > 0 && (
                      <div
                        className="absolute flex items-center justify-center transform -translate-x-1/2"
                        style={{ left: `${proteinCenter}%` }}
                      >
                        <span className="w-2 h-2 bg-blue-400 rounded-full mr-1"></span>
                        <span className="whitespace-nowrap">Protein</span>
                      </div>
                    )}

                    {/* Fat Label */}
                    {fatPct > 0 && (
                      <div
                        className="absolute flex items-center justify-center transform -translate-x-1/2"
                        style={{ left: `${fatCenter}%` }}
                      >
                        <span className="w-2 h-2 bg-purple-400 rounded-full mr-1"></span>
                        <span className="whitespace-nowrap">Fat</span>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Food Breakdown */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="flex items-center justify-between mb-4 gap-3">
              <h3 className="text-lg font-semibold text-gray-800">Food Breakdown</h3>
              <div className="flex items-center gap-2">
                {portionAnalysis &&
                  portionAnalysis.totalEstimatedWeight > 0 && (
                    <div className="text-sm text-gray-600 bg-gray-50 px-3 py-1 rounded-full">
                      Total: ~{Math.round(portionAnalysis.totalEstimatedWeight)}g
                    </div>
                  )}
                <button
                  type="button"
                  onClick={() => {
                    if (isAddingItem) {
                      resetAddItemForm();
                      return;
                    }
                    setAddItemError("");
                    setIsAddingItem(true);
                  }}
                  disabled={isSaving || editingIndex !== null}
                  className="px-3 py-1.5 text-sm font-medium rounded-lg bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isAddingItem ? "Cancel" : "+ Add Missing Item"}
                </button>
              </div>
            </div>

            {isAddingItem && (
              <div className="mb-4 p-3 rounded-xl border border-gray-200 bg-gray-50">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="relative md:col-span-2">
                    <input
                      type="text"
                      placeholder="Food name"
                      value={newItemName}
                      onChange={(e) => handleAddNameChange(e.target.value)}
                      onKeyDown={handleAddNameKeyDown}
                      onFocus={() => {
                        if (newItemName.trim().length > 0) {
                          setShowAddSuggestions(true);
                        }
                      }}
                      className="w-full relative md:col-span-2 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
                    />
                    {isAddSearching && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>
                    )}
                    {showAddSuggestions && addSearchResults.length > 0 && (
                      <div className="relative z-20 mt-1 w-full max-h-52 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                        {addSearchResults.map((food, idx) => (
                          <button
                            key={`${food.name}-${idx}`}
                            type="button"
                            onClick={() => handleSelectAddSuggestion(food)}
                            className={`w-full text-left px-3 py-2 border-b last:border-b-0 ${
                              idx === activeAddSuggestionIndex
                                ? "bg-green-100"
                                : "hover:bg-green-50"
                            }`}
                          >
                            <div className="text-sm font-medium text-gray-900 ">
                              {food.name}
                            </div>

                            {/* if we don't want food calories details */}

                            <div className="text-xs text-gray-600 mt-0.5">
                              {/* {food.defaultServing?.nutrition?.calories || 0} kcal
                              {" · "}
                              {food.defaultServing?.description || "1 serving"} */}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* <input
                    type="text"
                    placeholder="Portion (optional)"
                    value={newItemPortion}
                    onChange={(e) => setNewItemPortion(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
                  /> */}
                  <input
                    type="number"
                    min="1"
                    step="0.1"
                    placeholder="Quantity"
                    value={newItemQuantity}
                    onChange={(e) => setNewItemQuantity(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
                  />
                  <select
                    value={newItemUnit}
                    onChange={(e) => setNewItemUnit(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-300"
                  >
                    <option value="g">g</option>
                    <option value="ml">ml</option>
                  </select>
                </div>

                {addItemError && (
                  <p className="mt-2 text-sm text-red-600">{addItemError}</p>
                )}

                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={handleAddMissingItem}
                    disabled={isSaving}
                    className="px-4 py-2 text-sm font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSaving ? "Saving..." : "Add Item"}
                  </button>
                </div>
              </div>
            )}

            {localDetailedItems.length > 0 ? (
              <div className="space-y-3">
                {localDetailedItems.map((item, index) => (
                  <EditableFoodItem
                    key={index}
                    foodItem={item}
                    index={index}
                    onUpdate={handleFoodUpdate}
                    onDelete={handleDeleteItem}
                    onEditingChange={handleEditingChange}
                    disabled={editingIndex !== null && editingIndex !== index}
                    user={user}
                  />
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-500">No items yet. Add the first item manually.</div>
            )}
          </div>

          {/* Portion Analysis Section */}

          {/* Serving Info Details */}
          {servingInfo && servingInfo.weight && (
            <div className="text-xs text-gray-500 mt-6 p-3 bg-gray-50 rounded-lg">
              <strong>Serving Info:</strong> {servingInfo.weight}{" "}
              {servingInfo.unit}
              {servingInfo.description &&
                servingInfo.description !== servingInfo.weight && (
                  <span> ({servingInfo.description})</span>
                )}
            </div>
          )}

          {/* Share Button at Bottom - Only show if there's an image */}
          {(imagePreview || selectedImage) && (
            <button
              onClick={handleShare}
              disabled={isSharing || isSaving}
              className={`w-full mt-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all duration-200 shadow-md ${
                isSharing || isSaving
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:shadow-lg active:scale-[0.98]"
              }`}
              style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}>
          
              {isSharing ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Sharing...</span>
                </>
              ) : (
                <>
                  <Share2 className="w-5 h-5" />
                  <span>Share</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </>
  );
};

// Add display name for debugging
NutritionCard.displayName = "NutritionCard";

export default NutritionCard;
