// src/components/SmartFoodSearchModal.js
import React, { useState, useEffect, useRef, useCallback } from "react";
import { X, Search, Check, ShoppingCart } from "lucide-react";
import {
  dedupeSearchBuckets,
  resolveQuantityUnit,
  formatServingPortion,
} from "../domain/nutritionFields";
import { isFlagEnabled } from "../../../config/featureFlags";
import FloatingMealTray from "./meal-builder/FloatingMealTray";
import MealBuilderSheet from "./meal-builder/MealBuilderSheet";
import MealBowlIcon from "./meal-builder/MealBowlIcon";
import {
  buildPlateSavePayload,
  computeMacroSummary,
  computeSelectedKcal,
} from "./meal-builder/mealSelection";
import { toSelectableItem } from "./meal-builder/useMealSelection";
import { fetchFoodSuggestions } from "../services/foodSuggestionsApi";
import { filterSuggestionsAgainstSelected } from "../domain/foodSuggestionRank";

/**
 * SmartFoodSearchModal
 * Master DB + history search, then manual macros. Micros preserved (ADR-0005).
 * With ff.meal-builder: full-screen Add Food + Your Meal tray + suggestions.
 */
const SmartFoodSearchModal = ({
  isOpen,
  onClose,
  onSave,
  mealType = "",
  apiBaseUrl,
  userId,
  timeLabel,
  altSwitchButtons,
  skipTypeSelect = false,
  headerTitle = "Regular food",
  headerSubtitle = "Type the food item below",
  initialQuery = "",
  catalogMode = false,
}) => {
  const mealBuilderEnabled = isFlagEnabled("ff.meal-builder");
  const [showTypeSelect, setShowTypeSelect] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [masterItems, setMasterItems] = useState([]);
  const [myItems, setMyItems] = useState([]);
  const [communityItems, setCommunityItems] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [error, setError] = useState("");
  const [selectedItems, setSelectedItems] = useState([]);
  const [mealSheetOpen, setMealSheetOpen] = useState(false);
  const [addToast, setAddToast] = useState("");
  const [latestFoods, setLatestFoods] = useState([]);
  const [oftenWith, setOftenWith] = useState([]);

  const [manualName, setManualName] = useState("");
  const [manualCalories, setManualCalories] = useState("");
  const [manualProtein, setManualProtein] = useState("");
  const [manualCarbs, setManualCarbs] = useState("");
  const [manualFat, setManualFat] = useState("");
  const [manualFiber, setManualFiber] = useState("");

  const searchTimerRef = useRef(null);
  const searchAbortRef = useRef(null);
  const searchSeqRef = useRef(0);
  const inputRef = useRef(null);
  const saveStartedRef = useRef(false);
  const wasOpenRef = useRef(false);
  const addToastTimerRef = useRef(null);
  const selectedItemsRef = useRef(selectedItems);
  selectedItemsRef.current = selectedItems;

  const showAddToast = useCallback((msg) => {
    setAddToast(msg);
    if (addToastTimerRef.current) clearTimeout(addToastTimerRef.current);
    addToastTimerRef.current = setTimeout(() => setAddToast(""), 2800);
  }, []);

  const resetManualForm = () => {
    setManualName("");
    setManualCalories("");
    setManualProtein("");
    setManualCarbs("");
    setManualFat("");
    setManualFiber("");
  };

  useEffect(() => {
    if (isOpen) {
      wasOpenRef.current = true;
      const q = typeof initialQuery === "string" ? initialQuery : "";

      setShowTypeSelect(!skipTypeSelect);
      setSearchQuery(q);
      setMasterItems([]);
      setMyItems([]);
      setCommunityItems([]);
      setShowManualForm(false);
      setSelectedItems([]);
      setMealSheetOpen(false);
      setLatestFoods([]);
      setOftenWith([]);
      setAddToast("");
      setError("");
      resetManualForm();
      saveStartedRef.current = false;

      if (q.trim().length >= 1 || catalogMode) {
        setIsSearching(true);
        const timer = setTimeout(() => performSearch(q.trim()), 80);
        return () => clearTimeout(timer);
      }
      return undefined;
    }
    wasOpenRef.current = false;
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, skipTypeSelect, initialQuery, catalogMode]);

  useEffect(() => () => {
    if (addToastTimerRef.current) clearTimeout(addToastTimerRef.current);
  }, []);

  // Latest + Often added with (personal-first server ranking)
  useEffect(() => {
    if (!isOpen || !mealBuilderEnabled || catalogMode || !apiBaseUrl || !userId) return undefined;
    if (showTypeSelect && !skipTypeSelect) return undefined;

    const controller = new AbortController();
    const anchor = selectedItems.length
      ? selectedItems[selectedItems.length - 1].name
      : "";
    const exclude = selectedItems.map((s) => s.name);

    fetchFoodSuggestions({
      apiBaseUrl,
      userId,
      anchor,
      exclude,
      limit: 8,
      signal: controller.signal,
    })
      .then((data) => {
        setLatestFoods(data.latest || []);
        setOftenWith(data.oftenWith || []);
      })
      .catch(() => {
        /* abort / network — leave prior suggestions */
      });

    return () => controller.abort();
  }, [
    isOpen,
    mealBuilderEnabled,
    catalogMode,
    apiBaseUrl,
    userId,
    selectedItems,
    showTypeSelect,
    skipTypeSelect,
  ]);

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!catalogMode && (!searchQuery.trim() || searchQuery.trim().length < 1)) {
      if (searchAbortRef.current) searchAbortRef.current.abort();
      setMasterItems([]);
      setMyItems([]);
      setCommunityItems([]);
      setIsSearching(false);
      return undefined;
    }
    const delay = searchQuery.trim().length === 1 ? 280 : 220;
    searchTimerRef.current = setTimeout(() => {
      performSearch(searchQuery.trim());
    }, delay);
    return () => clearTimeout(searchTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, catalogMode]);

  const performSearch = async (query) => {
    if (!apiBaseUrl) return;
    if (!catalogMode && !userId) return;
    if (searchAbortRef.current) searchAbortRef.current.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;
    const seq = ++searchSeqRef.current;
    setIsSearching(true);
    try {
      const searchUrl = catalogMode
        ? `${apiBaseUrl}/api/dry-salad/search?query=${encodeURIComponent(query)}`
        : `${apiBaseUrl}/api/food-corrections/search?userId=${encodeURIComponent(userId)}&query=${encodeURIComponent(query)}`;
      const res = await fetch(searchUrl, { signal: controller.signal });
      const data = await res.json();
      if (seq !== searchSeqRef.current) return;
      if (data.success) {
        const buckets = dedupeSearchBuckets({
          masterItems: data.masterItems || [],
          myItems: data.myItems || [],
          communityItems: data.communityItems || [],
        }, query);
        setMasterItems(buckets.masterItems);
        setMyItems(buckets.myItems);
        setCommunityItems(buckets.communityItems);
      } else {
        setMasterItems([]);
        setMyItems([]);
        setCommunityItems([]);
      }
    } catch (err) {
      if (err?.name === "AbortError") return;
      if (seq !== searchSeqRef.current) return;
      setMasterItems([]);
      setMyItems([]);
      setCommunityItems([]);
    } finally {
      if (seq === searchSeqRef.current) setIsSearching(false);
    }
  };

  const handleToggleItem = (item) => {
    const prev = selectedItemsRef.current;
    const exists = prev.some((s) => s.name === item.name);
    if (exists) {
      const next = prev.filter((s) => s.name !== item.name);
      setSelectedItems(next);
      if (next.length === 0) setMealSheetOpen(false);
      return;
    }
    // Stay on search / suggestions — do not open sheet (blocks multi-add).
    setSelectedItems([...prev, toSelectableItem(item)]);
    showAddToast(`Added ${item.name}`);
  };

  const handleQuantityChange = (name, rawValue) => {
    const qty = parseFloat(rawValue);
    const whole = Number.isNaN(qty) || qty < 1 ? 1 : Math.round(qty);
    setSelectedItems((prev) =>
      prev.map((s) => (s.name === name ? { ...s, servings: whole } : s)),
    );
  };

  const submitSave = (payload) => {
    if (saveStartedRef.current) return;
    saveStartedRef.current = true;
    setError("");
    Promise.resolve(onSave?.(payload)).catch((err) => {
      saveStartedRef.current = false;
      setError(err?.message || "Failed to save");
    });
  };

  const handleAddSelected = () => {
    if (selectedItems.length === 0) return;
    setMealSheetOpen(false);
    submitSave(buildPlateSavePayload(selectedItems));
  };

  const handleManualSave = () => {
    setError("");
    if (!manualName.trim()) {
      setError("Please enter a food name");
      return;
    }
    const calories = parseFloat(manualCalories);
    if (!manualCalories || Number.isNaN(calories) || calories < 0) {
      setError("Please enter valid calories");
      return;
    }
    submitSave({
      foodName: manualName.trim(),
      calories: Math.round(calories),
      protein: Math.round(parseFloat(manualProtein) || 0),
      carbs: Math.round(parseFloat(manualCarbs) || 0),
      fat: Math.round(parseFloat(manualFat) || 0),
      fiber: Math.round(parseFloat(manualFiber) || 0),
      portion: "1 serving",
    });
  };

  const handleClose = () => {
    setShowTypeSelect(true);
    setSearchQuery("");
    setMasterItems([]);
    setMyItems([]);
    setCommunityItems([]);
    setShowManualForm(false);
    setSelectedItems([]);
    setError("");
    resetManualForm();
    onClose();
  };

  const handleBackFromFoodEntry = () => {
    if (skipTypeSelect) {
      handleClose();
      return;
    }
    setShowTypeSelect(true);
    setSearchQuery("");
    setShowManualForm(false);
    setError("");
  };

  if (!isOpen) return null;

  const hasMasterItems = masterItems.length > 0;
  const hasMyItems = myItems.length > 0;
  const hasCommunityItems = communityItems.length > 0;
  const hasSelected = selectedItems.length > 0;
  const selectedTotal = computeSelectedKcal(selectedItems);
  const macroSummary = computeMacroSummary(selectedItems);
  const showFoodEntry = skipTypeSelect || !showTypeSelect;
  const useFullScreen = mealBuilderEnabled && showFoodEntry;
  const searching = searchQuery.trim().length >= 1 || catalogMode;
  const suggestionRows = hasSelected
    ? filterSuggestionsAgainstSelected(oftenWith, selectedItems)
    : filterSuggestionsAgainstSelected(latestFoods, selectedItems);

  const searchBar = !showManualForm && (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
      <input
        ref={inputRef}
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder={catalogMode ? "Search dry salad…" : "Search for food..."}
        className="w-full pl-9 pr-10 py-3 border-2 border-gray-200 focus:border-green-500 rounded-xl outline-none text-sm bg-white transition-colors"
        style={{ fontSize: "16px" }}
      />
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
        {isSearching && (
          <div className="p-1.5">
            <svg className="animate-spin w-4 h-4 text-green-500" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          </div>
        )}
        {searchQuery.length > 0 && !isSearching && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="p-1.5 text-gray-400 hover:text-gray-600"
            aria-label="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );

  const renderFoodRows = (items, keyPrefix, mealBuilder) =>
    items.map((item) => (
      <FoodItemRow
        key={`${keyPrefix}-${item.name}`}
        item={item}
        selected={selectedItems.some((s) => s.name === item.name)}
        onToggle={handleToggleItem}
        mealBuilder={mealBuilder}
      />
    ));

  // ── Full-screen Meal Builder ──────────────────────────────────────────────
  if (useFullScreen) {
    return (
      <div
        className="fixed inset-0 z-50 bg-white flex flex-col"
        style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex items-center gap-2 px-4 pt-3 pb-2 border-b border-gray-100 flex-shrink-0">
          <button
            type="button"
            onClick={handleBackFromFoodEntry}
            className="p-1.5 rounded-xl hover:bg-gray-100"
            aria-label="Back"
          >
            <svg className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="flex-1 text-center text-base font-bold text-gray-900 pr-8">Add Food</h1>
        </div>

        <div className={`flex-1 overflow-y-auto px-4 py-3 space-y-3 ${hasSelected ? "pb-28" : ""}`}>
          {searchBar}

          {addToast && (
            <p className="text-[11px] text-green-700 font-medium px-1" role="status">
              {addToast}
            </p>
          )}

          {!showManualForm && !searching && suggestionRows.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2 px-0.5">
                <p className="text-sm font-bold text-gray-900">
                  {hasSelected ? "Often added with" : "Latest"}
                </p>
              </div>
              <div className="space-y-1.5">
                {renderFoodRows(suggestionRows, hasSelected ? "often" : "latest", true)}
              </div>
            </div>
          )}

          {!showManualForm && searching && (
            <div className="space-y-4">
              {hasMasterItems && (
                <div>
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5 px-1">
                    {catalogMode ? "Dry Salad catalog" : "Nutrition library"}
                  </p>
                  <div className="space-y-1.5">
                    {renderFoodRows(masterItems, "master", true)}
                  </div>
                </div>
              )}
              {!catalogMode && hasMyItems && (
                <div>
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5 px-1">My History</p>
                  <div className="space-y-1.5">{renderFoodRows(myItems, "my", true)}</div>
                </div>
              )}
              {!catalogMode && hasCommunityItems && (
                <div>
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5 px-1">Community</p>
                  <div className="space-y-1.5">{renderFoodRows(communityItems, "community", true)}</div>
                </div>
              )}
              {!isSearching && !hasMasterItems && !hasMyItems && !hasCommunityItems && (
                <p className="text-sm text-gray-400 text-center py-4">
                  No food found — try a different name
                </p>
              )}
            </div>
          )}

          {!showManualForm && !searching && suggestionRows.length === 0 && !hasSelected && (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <div className="w-14 h-14 rounded-2xl bg-green-50 flex items-center justify-center mb-3">
                <MealBowlIcon size={36} />
              </div>
              <p className="text-sm font-medium text-gray-600">Build your meal</p>
              <p className="text-xs text-gray-400 mt-1">Search or tap + to build your meal</p>
            </div>
          )}

          {showManualForm && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Food Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="e.g., Grilled Chicken Breast"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-green-500 outline-none text-sm"
                  style={{ fontSize: "16px" }}
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <MacroField label="Calories (kcal)" required value={manualCalories} onChange={setManualCalories} placeholder="e.g. 250" />
                <MacroField label="Protein (g)" value={manualProtein} onChange={setManualProtein} placeholder="e.g. 30" />
                <MacroField label="Carbs (g)" value={manualCarbs} onChange={setManualCarbs} placeholder="e.g. 20" />
                <MacroField label="Fat (g)" value={manualFat} onChange={setManualFat} placeholder="e.g. 5" />
                <MacroField label="Fiber (g)" value={manualFiber} onChange={setManualFiber} placeholder="e.g. 2" span />
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}
        </div>

        {showManualForm ? (
          <div className="flex gap-3 px-4 pb-4 pt-3 border-t border-gray-100 flex-shrink-0">
            <button
              type="button"
              onClick={() => { setShowManualForm(false); setError(""); }}
              className="px-4 py-3 border-2 border-gray-200 text-gray-600 rounded-xl text-sm font-semibold"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={handleManualSave}
              className="flex-1 px-4 py-3 bg-green-600 text-white rounded-xl text-sm font-semibold"
            >
              Save Food
            </button>
          </div>
        ) : hasSelected ? (
          <FloatingMealTray
            items={selectedItems}
            totalKcal={selectedTotal}
            onOpenSheet={() => setMealSheetOpen(true)}
            onSave={handleAddSelected}
          />
        ) : null}

        <MealBuilderSheet
          open={mealSheetOpen && hasSelected}
          items={selectedItems}
          totalKcal={selectedTotal}
          macroSummary={macroSummary}
          onClose={() => setMealSheetOpen(false)}
          onSave={handleAddSelected}
          onClear={() => {
            setSelectedItems([]);
            setMealSheetOpen(false);
          }}
          onRemove={(item) => {
            handleToggleItem(item);
          }}
          onQuantityChange={handleQuantityChange}
        />
      </div>
    );
  }

  // ── Legacy modal (flag OFF or type-select) ────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[90vh] flex flex-col relative">

        {showTypeSelect && !skipTypeSelect && (
          <>
            <div className="flex items-start justify-between px-4 pt-4 pb-2 flex-shrink-0">
              <div>
                <p className="text-sm font-bold text-gray-900 leading-snug">AI Unavailable</p>
                <p className="text-[11px] text-gray-400 mt-0.5 leading-snug max-w-[220px]">
                  AI couldn&apos;t detect your input. Please log manually.
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="p-1.5 rounded-xl hover:bg-gray-100 flex-shrink-0"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="px-4 pb-3">
              <button
                type="button"
                onClick={() => setShowTypeSelect(false)}
                className="w-full text-white rounded-[16px] py-3 px-4 flex flex-col items-center justify-center gap-1 transition-all active:scale-[0.97]"
                style={{
                  background: "linear-gradient(135deg, #f97316 0%, #fb923c 60%, #fdba74 100%)",
                  boxShadow: "0 6px 18px rgba(249,115,22,0.30)",
                }}
              >
                <span className="text-2xl leading-none">🍽️</span>
                <span className="text-sm font-bold tracking-tight">Log Food</span>
                <span className="text-[11px] font-normal opacity-80">{timeLabel || "Add it manually"}</span>
              </button>
            </div>
          </>
        )}

        {showFoodEntry && (
          <>
            <div className="flex items-center justify-between px-4 pt-3 pb-2.5 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleBackFromFoodEntry}
                  className="p-1.5 rounded-xl hover:bg-gray-100"
                  aria-label="Back"
                >
                  <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-gray-900">{headerTitle || "Regular food"}</h2>
                    {hasSelected && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 text-orange-700 px-2 py-0.5 text-[11px] font-semibold">
                        <ShoppingCart className="w-3 h-3" aria-hidden />
                        Cart {selectedItems.length}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">{headerSubtitle || "Type the food item below"}</p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
              {searchBar}

              {!showManualForm && hasSelected && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl px-3 py-2.5">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-orange-700">
                      {selectedItems.length} item{selectedItems.length > 1 ? "s" : ""} · {selectedTotal} kcal total
                    </p>
                    <button type="button" onClick={() => setSelectedItems([])} className="text-[11px] text-orange-400 font-medium">
                      Clear all
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {selectedItems.map((item) => {
                      const count = Number(item.servings);
                      const servings = Number.isFinite(count) && count > 0 ? count : 1;
                      const kcal = Math.round((item.calories ?? 0) * servings);
                      const unitLabel = item.quantityLabel || resolveQuantityUnit(item).shortLabel;
                      return (
                        <div key={item.name} className="flex items-center gap-2 bg-white border border-orange-100 rounded-xl px-2.5 py-1.5">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-800 truncate">{item.name}</p>
                            <p className="text-[11px] text-orange-600 font-semibold">
                              {kcal} kcal
                              {(item.portion || item.portion_label) ? (
                                <span className="font-normal text-gray-400"> · {formatServingPortion(item, servings)}</span>
                              ) : null}
                            </p>
                          </div>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={item.servings ?? 1}
                            onChange={(e) => handleQuantityChange(item.name, e.target.value)}
                            className="w-12 text-center border border-orange-200 rounded-lg px-1.5 py-1 text-xs"
                            style={{ fontSize: "14px" }}
                            aria-label={`Number of ${unitLabel}`}
                          />
                          <span className="text-[11px] text-gray-500 min-w-[2.5rem]">{unitLabel}</span>
                          <button type="button" onClick={() => handleToggleItem(item)} className="text-gray-300 hover:text-red-400">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {!showManualForm && searching && (
                <div className="space-y-4">
                  {hasMasterItems && (
                    <div>
                      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5 px-1">
                        {catalogMode ? "Dry Salad catalog" : "Nutrition library"}
                      </p>
                      <div className="space-y-1.5">{renderFoodRows(masterItems, "master", false)}</div>
                    </div>
                  )}
                  {!catalogMode && hasMyItems && (
                    <div>
                      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5 px-1">My History</p>
                      <div className="space-y-1.5">{renderFoodRows(myItems, "my", false)}</div>
                    </div>
                  )}
                  {!catalogMode && hasCommunityItems && (
                    <div>
                      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5 px-1">Community</p>
                      <div className="space-y-1.5">{renderFoodRows(communityItems, "community", false)}</div>
                    </div>
                  )}
                </div>
              )}

              {showManualForm && (
                <div className="space-y-4">
                  <MacroField label="Food Name" required value={manualName} onChange={setManualName} placeholder="e.g. Chicken" />
                  <div className="grid grid-cols-2 gap-3">
                    <MacroField label="Calories (kcal)" required value={manualCalories} onChange={setManualCalories} placeholder="250" />
                    <MacroField label="Protein (g)" value={manualProtein} onChange={setManualProtein} placeholder="30" />
                    <MacroField label="Carbs (g)" value={manualCarbs} onChange={setManualCarbs} placeholder="20" />
                    <MacroField label="Fat (g)" value={manualFat} onChange={setManualFat} placeholder="5" />
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>
              )}
            </div>

            <div className="flex gap-3 px-5 pb-3 pt-3 border-t border-gray-100 flex-shrink-0">
              {showManualForm ? (
                <>
                  <button type="button" onClick={() => setShowManualForm(false)} className="px-4 py-3 border-2 border-gray-200 rounded-xl text-sm font-semibold">← Back</button>
                  <button type="button" onClick={handleManualSave} className="flex-1 px-4 py-3 bg-orange-500 text-white rounded-xl text-sm font-semibold">Save Food</button>
                </>
              ) : hasSelected ? (
                <>
                  <button type="button" onClick={() => setSelectedItems([])} className="px-4 py-3 border-2 border-gray-200 rounded-xl text-sm font-semibold">Clear</button>
                  <button type="button" onClick={handleAddSelected} className="flex-1 px-4 py-3 bg-green-600 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2">
                    <Check className="w-4 h-4" /> Save
                  </button>
                </>
              ) : (
                <button type="button" onClick={handleClose} className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-xl text-sm font-semibold">Cancel</button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const FoodItemRow = ({ item, selected, onToggle, mealBuilder = false }) => {
  const portion = item.portion || item.portion_label;
  if (mealBuilder) {
    return (
      <div
        className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 border-2 transition-colors text-left ${
          selected ? "bg-green-50 border-green-500" : "bg-white border-gray-200"
        }`}
      >
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium truncate ${selected ? "text-green-900" : "text-gray-800"}`}>{item.name}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {portion ? <span>{portion} · </span> : null}
            {item.calories ?? "?"} kcal
            {item.protein ? ` · ${item.protein}g protein` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onToggle(item)}
          aria-label={selected ? `Remove ${item.name}` : `Add ${item.name}`}
          className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-bold text-lg transition-colors ${
            selected
              ? "bg-green-600 text-white"
              : "bg-green-50 text-green-700 border-2 border-green-300 hover:bg-green-100"
          }`}
        >
          {selected ? <Check className="w-4 h-4" /> : "+"}
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onToggle(item)}
      className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 border-2 transition-colors text-left ${
        selected ? "bg-orange-50 border-orange-400" : "bg-white border-gray-200 hover:border-orange-300"
      }`}
    >
      <div className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
        selected ? "bg-orange-500 border-orange-500" : "border-gray-300"
      }`}>
        {selected && <Check className="w-3 h-3 text-white" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${selected ? "text-orange-800" : "text-gray-800"}`}>{item.name}</p>
        <p className="text-xs text-gray-400 mt-0.5">
          {portion ? <span>{portion} · </span> : null}
          {item.calories ?? "?"} kcal
        </p>
      </div>
    </button>
  );
};

const MacroField = ({ label, value, onChange, placeholder, required, span }) => (
  <div className={span ? "col-span-2" : ""}>
    <label className="block text-xs font-semibold text-gray-600 mb-1">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <input
      type="text"
      inputMode="decimal"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:border-orange-400 focus:outline-none text-sm"
      style={{ fontSize: "16px" }}
    />
  </div>
);

export default SmartFoodSearchModal;
