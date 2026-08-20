// src/components/SmartFoodSearchModal.js
import React, { useState, useEffect, useRef } from "react";
import { X, Search, Check, ShoppingCart } from "lucide-react";
import {
  scaleNutritionFields,
  sumNutrition,
  pickNutrition,
  dedupeSearchBuckets,
  resolveQuantityUnit,
  formatServingPortion,
  referenceWeightG,
} from "../domain/nutritionFields";

/**
 * SmartFoodSearchModal
 * Master DB + history search, then manual macros. Micros preserved (ADR-0005).
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
  // When true, skip the "AI Unavailable / Log Food" type-select screen and go
  // directly to the search/manual form. Use when the caller has already
  // established the entry type (e.g. UnknownEntryFlow after picking Food).
  skipTypeSelect = false,
  // Optional overrides when opened from Healthy Snacks & Soups (or similar).
  headerTitle = "Regular food",
  headerSubtitle = "Type the food item below",
  initialQuery = "",
  // When true, search GET /api/dry-salad/search (catalog table only).
  catalogMode = false,
}) => {
  const [showTypeSelect, setShowTypeSelect] = useState(true); // initial screen: show 3 type buttons
  const [searchQuery, setSearchQuery] = useState("");
  const [masterItems, setMasterItems] = useState([]);
  const [myItems, setMyItems] = useState([]);
  const [communityItems, setCommunityItems] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [error, setError] = useState("");
  const [selectedItems, setSelectedItems] = useState([]); // items chosen for this meal

  // Manual form fields
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
  // Prevents double-submit while parent closes + saves in background.
  const saveStartedRef = useRef(false);

  // Track whether the modal was open on the previous render so we can detect
  // the exact open transition regardless of React batching order.
  const wasOpenRef = useRef(false);

  // Reset state on open. We watch isOpen + initialQuery so that if initialQuery
  // arrives one render after isOpen=true (React batching), we still catch it.
  useEffect(() => {
    if (isOpen) {
      const justOpened = !wasOpenRef.current;
      wasOpenRef.current = true;
      const q = typeof initialQuery === "string" ? initialQuery : "";

      setShowTypeSelect(!skipTypeSelect);
      setSearchQuery(q);
      setMasterItems([]);
      setMyItems([]);
      setCommunityItems([]);
      setShowManualForm(false);
      setSelectedItems([]);
      setError("");
      resetManualForm();
      saveStartedRef.current = false;

      // Kick off search for the initial query. Use a short delay so all state
      // setters above have been applied before the fetch runs.
      if (q.trim().length >= 1 || catalogMode) {
        setIsSearching(true);
        const timer = setTimeout(() => performSearch(q.trim()), 80);
        return () => clearTimeout(timer);
      }
      return undefined;
    } else {
      wasOpenRef.current = false;
      return undefined;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- performSearch ref is stable
  }, [isOpen, skipTypeSelect, initialQuery, catalogMode]);

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

  // Debounced search — abort in-flight so slow "y" responses can't overwrite newer queries
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
    // Longer debounce for 1-letter (noisy); shorter once the user has typed more
    const delay = searchQuery.trim().length === 1 ? 280 : 220;
    searchTimerRef.current = setTimeout(() => {
      performSearch(searchQuery.trim());
    }, delay);
    return () => clearTimeout(searchTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: listed deps would cause an infinite re-render
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
      if (err?.name === 'AbortError') return;
      if (seq !== searchSeqRef.current) return;
      setMasterItems([]);
      setMyItems([]);
      setCommunityItems([]);
    } finally {
      if (seq === searchSeqRef.current) setIsSearching(false);
    }
  };

  const resetManualForm = () => {
    setManualName("");
    setManualCalories("");
    setManualProtein("");
    setManualCarbs("");
    setManualFat("");
    setManualFiber("");
  };

  const handleToggleItem = (item) => {
    setSelectedItems(prev => {
      const exists = prev.some(s => s.name === item.name);
      if (exists) return prev.filter(s => s.name !== item.name);
      const qtyUnit = resolveQuantityUnit(item);
      // Quantity is servings/pcs/cups — nutrition on the item is for 1 unit.
      return [...prev, {
        ...item,
        servings: 1,
        refWeightG: referenceWeightG(item),
        quantityUnit: qtyUnit.unit,
        quantityLabel: qtyUnit.shortLabel,
      }];
    });
  };

  const handleQuantityChange = (name, rawValue) => {
    const qty = parseFloat(rawValue);
    setSelectedItems(prev =>
      prev.map(s => s.name === name
        ? { ...s, servings: isNaN(qty) || qty < 0 ? 0 : qty }
        : s)
    );
  };

  // Scale nutrition by serving count (1 unit = reference weight / profile portion).
  const scaledItem = (item) => {
    const servings = Number(item.servings);
    const count = Number.isFinite(servings) && servings > 0 ? servings : 1;
    const nutrition = scaleNutritionFields(item, count);
    const refW = item.refWeightG ?? referenceWeightG(item);
    return {
      name: item.name,
      weight_g: Math.round(refW * count),
      portion: formatServingPortion(item, count),
      nutrition,
      ...nutrition,
    };
  };

  /**
   * Hand off to parent without blocking the Save button on network.
   * Parent closes this modal and runs promote/share in the background.
   */
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
    const scaled = selectedItems.map(scaledItem);
    const total = sumNutrition(scaled.map((f) => pickNutrition(f)));
    submitSave({
      items: scaled,
      total,
      isPlate: true,
      plateName: selectedItems.map((f) => f.name).join(", "),
    });
  };

  const handleManualSave = () => {
    setError("");
    if (!manualName.trim()) {
      setError("Please enter a food name");
      return;
    }
    const calories = parseFloat(manualCalories);
    if (!manualCalories || isNaN(calories) || calories < 0) {
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

  if (!isOpen) return null;

  const hasMasterItems = masterItems.length > 0;
  const hasMyItems = myItems.length > 0;
  const hasCommunityItems = communityItems.length > 0;
  const hasSelected = selectedItems.length > 0;
  const selectedTotal = selectedItems.reduce((s, f) => {
    const count = Number(f.servings);
    const servings = Number.isFinite(count) && count > 0 ? count : 1;
    return s + Math.round((f.calories ?? 0) * servings);
  }, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[90vh] flex flex-col">

        {/* ── Type Selection Screen ── */}
        {showTypeSelect && !skipTypeSelect && (
          <>
            {/* Header */}
            <div className="flex items-start justify-between px-4 pt-4 pb-2 flex-shrink-0">
              <div>
                <p className="text-sm font-bold text-gray-900 leading-snug">AI Unavailable</p>
                <p className="text-[11px] text-gray-400 mt-0.5 leading-snug max-w-[220px]">
                  AI couldn't detect your input. Please log manually.
                </p>
              </div>
              <button
                onClick={handleClose}
                className="p-1.5 rounded-xl hover:bg-gray-100 active:bg-gray-200 transition-colors flex-shrink-0"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            {/* Primary food card */}
            <div className="px-4 pb-3">
              <button
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

        {/* ── Food Entry Screen ── */}
        {(skipTypeSelect || !showTypeSelect) && (
          <>
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2.5 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={handleBackFromFoodEntry}
              className="p-1.5 rounded-xl hover:bg-gray-100 active:bg-gray-200 transition-colors"
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
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-orange-100 text-orange-700 px-2 py-0.5 text-[11px] font-semibold"
                    aria-label={`Cart ${selectedItems.length}`}
                  >
                    <ShoppingCart className="w-3 h-3" aria-hidden />
                    Cart {selectedItems.length}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400">{headerSubtitle || "Type the food item below"}</p>
            </div>
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">

          {/* Search bar */}
          {!showManualForm && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={catalogMode ? "Search dry salad (e.g. herbalife…)" : "Search food (e.g. chicken, rice…)"}
                className="w-full pl-9 pr-10 py-3 border-2 border-gray-200 focus:border-orange-400 rounded-xl outline-none text-sm bg-white transition-colors"
                style={{ fontSize: "16px" }}
              />
              {isSearching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <svg className="animate-spin w-4 h-4 text-orange-400" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                </div>
              )}
              {searchQuery.length > 0 && !isSearching && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          {/* ── Selected items with portions ── */}
          {!showManualForm && hasSelected && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl px-3 py-2.5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-orange-700">{selectedItems.length} item{selectedItems.length > 1 ? "s" : ""} · {selectedTotal} kcal total</p>
                <button onClick={() => setSelectedItems([])} className="text-[11px] text-orange-400 hover:text-orange-600 font-medium">Clear all</button>
              </div>
              <div className="space-y-1.5">
                {selectedItems.map(item => {
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
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <input
                          type="text"
                          inputMode="decimal"
                          pattern="[0-9]*"
                          value={item.servings ?? 1}
                          onChange={(e) => handleQuantityChange(item.name, e.target.value)}
                          className="w-12 text-center border border-orange-200 rounded-lg px-1.5 py-1 text-xs focus:outline-none focus:border-orange-400"
                          style={{ fontSize: "14px" }}
                          aria-label={`Number of ${unitLabel}`}
                        />
                        <span className="text-[11px] text-gray-500 min-w-[2.5rem]">{unitLabel}</span>
                      </div>
                      <button onClick={() => handleToggleItem(item)} className="flex-shrink-0 text-gray-300 hover:text-red-400 transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Search results ── */}
          {!showManualForm && (searchQuery.trim().length >= 1 || catalogMode) && (
            <div className="space-y-4">
              {hasMasterItems && (
                <div>
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5 px-1">
                    {catalogMode ? "Dry Salad catalog" : "Nutrition library"}
                  </p>
                  <div className="space-y-1.5">
                    {masterItems.map((item) => (
                      <FoodItemRow
                        key={`master-${item.name}`}
                        item={item}
                        selected={selectedItems.some(s => s.name === item.name)}
                        onToggle={handleToggleItem}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* My items */}
              {!catalogMode && hasMyItems && (
                <div>
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5 px-1">My History</p>
                  <div className="space-y-1.5">
                    {myItems.map((item) => (
                      <FoodItemRow
                        key={`my-${item.name}`}
                        item={item}
                        selected={selectedItems.some(s => s.name === item.name)}
                        onToggle={handleToggleItem}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Community items */}
              {!catalogMode && hasCommunityItems && (
                <div>
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5 px-1">Community</p>
                  <div className="space-y-1.5">
                    {communityItems.map((item) => (
                      <FoodItemRow
                        key={`community-${item.name}`}
                        item={item}
                        selected={selectedItems.some(s => s.name === item.name)}
                        onToggle={handleToggleItem}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* No results */}
              {!isSearching && !hasMasterItems && !hasMyItems && !hasCommunityItems && (
                <p className="text-sm text-gray-400 text-center py-4">
                  {catalogMode
                    ? "No dry salad found — try a different name or add manually"
                    : "No food found — try a different name or add manually"}
                </p>
              )}
            </div>
          )}

          {/* ── Empty state (only when nothing selected) ── */}
          {!showManualForm && searchQuery.trim().length < 1 && !hasSelected && !catalogMode && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-14 h-14 rounded-2xl bg-orange-50 flex items-center justify-center mb-3">
                <Search className="w-6 h-6 text-orange-400" />
              </div>
              <p className="text-sm font-medium text-gray-600">Search food suggestions</p>
              <p className="text-xs text-gray-400 mt-1">Type a letter to see matching foods</p>
            </div>
          )}

          {/* ── Manual form ── */}
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
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-400 outline-none text-sm transition-colors"
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

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex gap-3 px-5 pb-3 pt-3 border-t border-gray-100 flex-shrink-0">
          {showManualForm ? (
            <>
              <button
                onClick={() => { setShowManualForm(false); setError(""); }}
                className="px-4 py-3 border-2 border-gray-200 text-gray-600 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={handleManualSave}
                className="flex-1 px-4 py-3 bg-orange-500 text-white rounded-xl text-sm font-semibold hover:bg-orange-600 active:bg-orange-700 transition-colors flex items-center justify-center gap-2"
              >
                Save Food
              </button>
            </>
          ) : hasSelected ? (
            <>
              <button
                onClick={() => setSelectedItems([])}
                className="px-4 py-3 border-2 border-gray-200 text-gray-600 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors"
              >
                Clear
              </button>
              <button
                onClick={handleAddSelected}
                className="flex-1 px-4 py-3 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 active:bg-green-800 transition-colors flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                Save
              </button>
            </>
          ) : (
            <button
              onClick={handleClose}
              className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>

          </>
        )}

      </div>
    </div>
  );
};

// ── Sub-components ──────────────────────────────────────────────────────────

const FoodItemRow = ({ item, selected, onToggle }) => {
  const portion = item.portion || item.portion_label;
  return (
    <button
      onClick={() => onToggle(item)}
      className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 border-2 transition-colors text-left ${
        selected
          ? "bg-orange-50 border-orange-400"
          : "bg-white border-gray-200 hover:border-orange-300"
      }`}
    >
      <div className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
        selected ? "bg-orange-500 border-orange-500" : "border-gray-300"
      }`}>
        {selected && <Check className="w-3 h-3 text-white" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${selected ? "text-orange-800" : "text-gray-800"}`}>{item.name}</p>
        <p className="text-xs text-gray-400 mt-0.5">
          {portion ? <span>{portion} · </span> : null}
          {item.calories ?? "?"} kcal
          {item.protein ? ` · ${item.protein}g protein` : ""}
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
      pattern="[0-9]*"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:border-orange-400 focus:outline-none text-sm"
      style={{ fontSize: "16px" }}
    />
  </div>
);

export default SmartFoodSearchModal;
