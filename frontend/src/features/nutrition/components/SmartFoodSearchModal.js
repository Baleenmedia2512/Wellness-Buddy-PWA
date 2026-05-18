// src/components/SmartFoodSearchModal.js
import React, { useState, useEffect, useRef } from "react";
import { X, Search, Check } from "lucide-react";

/**
 * SmartFoodSearchModal
 * 3-phase food entry when AI is unavailable:
 *  Phase 1 — search own history (food_corrections_table where UserId = me)
 *  Phase 2 — search global corrections (all users)
 *  Phase 3 — quick manual add form (type all macros)
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
}) => {
  const [showTypeSelect, setShowTypeSelect] = useState(true); // initial screen: show 3 type buttons
  const [searchQuery, setSearchQuery] = useState("");
  const [myItems, setMyItems] = useState([]);
  const [communityItems, setCommunityItems] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
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
  const inputRef = useRef(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setShowTypeSelect(true);
      setSearchQuery("");
      setMyItems([]);
      setCommunityItems([]);
      setShowManualForm(false);
      setSelectedItems([]);
      setError("");
      resetManualForm();
    }
  }, [isOpen]);

  // Debounced search
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setMyItems([]);
      setCommunityItems([]);
      return;
    }
    searchTimerRef.current = setTimeout(() => {
      performSearch(searchQuery.trim());
    }, 350);
    return () => clearTimeout(searchTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps // intentional: listed deps would cause an infinite re-render // intentional: adding this dep causes an infinite re-render loop
  }, [searchQuery]);

  const performSearch = async (query) => {
    if (!userId || !apiBaseUrl) return;
    setIsSearching(true);
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/food-corrections/search?userId=${encodeURIComponent(userId)}&query=${encodeURIComponent(query)}`
      );
      const data = await res.json();
      if (data.success) {
        setMyItems(data.myItems || []);
        setCommunityItems(data.communityItems || []);
      } else {
        setMyItems([]);
        setCommunityItems([]);
      }
    } catch {
      setMyItems([]);
      setCommunityItems([]);
    } finally {
      setIsSearching(false);
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
      // Store base macros with the original weight_g as reference
      return [...prev, { ...item, quantity: item.weight_g ?? 100 }];
    });
  };

  const handleQuantityChange = (name, rawValue) => {
    const qty = parseFloat(rawValue);
    setSelectedItems(prev =>
      prev.map(s => s.name === name ? { ...s, quantity: isNaN(qty) || qty < 0 ? 0 : qty } : s)
    );
  };

  // Scale macros by quantity relative to original weight_g
  const scaledItem = (item) => {
    const baseWeight = item.weight_g ?? 100;
    const ratio = (item.quantity ?? baseWeight) / baseWeight;
    return {
      name: item.name,
      calories: Math.round((item.calories ?? 0) * ratio),
      protein: Math.round((item.protein ?? 0) * ratio),
      carbs: Math.round((item.carbs ?? 0) * ratio),
      fat: Math.round((item.fat ?? 0) * ratio),
      fiber: Math.round((item.fiber ?? 0) * ratio),
      portion: `${item.quantity ?? 100}g`,
    };
  };

  const handleAddSelected = async () => {
    if (selectedItems.length === 0) return;
    setError("");
    setIsSaving(true);
    try {
      const scaled = selectedItems.map(scaledItem);
      const total = scaled.reduce((acc, f) => ({
        calories: acc.calories + f.calories,
        protein: acc.protein + f.protein,
        carbs: acc.carbs + f.carbs,
        fat: acc.fat + f.fat,
        fiber: acc.fiber + f.fiber,
      }), { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
      await onSave({
        items: scaled,
        total,
        isPlate: true,
        plateName: selectedItems.map(f => f.name).join(", "),
      });
    } catch (err) {
      setError(err.message || "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const handleManualSave = async () => {
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
    setIsSaving(true);
    try {
      await onSave({
        foodName: manualName.trim(),
        calories: Math.round(calories),
        protein: Math.round(parseFloat(manualProtein) || 0),
        carbs: Math.round(parseFloat(manualCarbs) || 0),
        fat: Math.round(parseFloat(manualFat) || 0),
        fiber: Math.round(parseFloat(manualFiber) || 0),
        portion: "1 serving",
      });
    } catch (err) {
      setError(err.message || "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setShowTypeSelect(true);
    setSearchQuery("");
    setMyItems([]);
    setCommunityItems([]);
    setShowManualForm(false);
    setSelectedItems([]);
    setError("");
    resetManualForm();
    onClose();
  };

  if (!isOpen) return null;

  const hasMyItems = myItems.length > 0;
  const hasCommunityItems = communityItems.length > 0;
  const hasSelected = selectedItems.length > 0;
  const selectedTotal = selectedItems.reduce((s, f) => {
    const base = f.weight_g ?? 100;
    const ratio = (f.quantity ?? base) / base;
    return s + Math.round((f.calories ?? 0) * ratio);
  }, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[90vh] flex flex-col">

        {/* ── Type Selection Screen ── */}
        {showTypeSelect && (
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
        {!showTypeSelect && (
          <>
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2.5 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setShowTypeSelect(true); setSearchQuery(""); setShowManualForm(false); setError(""); }}
              className="p-1.5 rounded-xl hover:bg-gray-100 active:bg-gray-200 transition-colors"
              aria-label="Back"
            >
              <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h2 className="text-sm font-bold text-gray-900">Log Food</h2>
              <p className="text-xs text-gray-400">Search your previous food</p>
            </div>
          </div>
          <button onClick={handleClose} className="p-1.5 rounded-xl hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4 text-gray-400" />
          </button>
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
                placeholder="Search food (e.g. chicken, rice…)"
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
                  const base = item.weight_g ?? 100;
                  const kcal = Math.round((item.calories ?? 0) * (item.quantity ?? base) / base);
                  return (
                    <div key={item.name} className="flex items-center gap-2 bg-white border border-orange-100 rounded-xl px-2.5 py-1.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-800 truncate">{item.name}</p>
                        <p className="text-[11px] text-orange-600 font-semibold">{kcal} kcal</p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <input
                          type="number"
                          inputMode="decimal"
                          value={item.quantity ?? 100}
                          onChange={(e) => handleQuantityChange(item.name, e.target.value)}
                          className="w-14 text-center border border-orange-200 rounded-lg px-1.5 py-1 text-xs focus:outline-none focus:border-orange-400"
                          style={{ fontSize: "14px" }}
                          min="0"
                        />
                        <span className="text-[11px] text-gray-400">g</span>
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
          {!showManualForm && searchQuery.trim().length >= 2 && (
            <div className="space-y-4">
              {/* My items */}
              {hasMyItems && (
                <div>
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5 px-1">📌 My History</p>
                  <div className="space-y-1.5">
                    {myItems.map((item) => (
                      <FoodItemRow
                        key={item.name}
                        item={item}
                        selected={selectedItems.some(s => s.name === item.name)}
                        onToggle={handleToggleItem}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Community items */}
              {hasCommunityItems && (
                <div>
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5 px-1">🌐 Community</p>
                  <div className="space-y-1.5">
                    {communityItems.map((item) => (
                      <FoodItemRow
                        key={item.name}
                        item={item}
                        selected={selectedItems.some(s => s.name === item.name)}
                        onToggle={handleToggleItem}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* No results */}
              {!isSearching && !hasMyItems && !hasCommunityItems && (
                <p className="text-sm text-gray-400 text-center py-4">No food found — try a different name or add manually</p>
              )}
            </div>
          )}

          {/* ── Empty state (only when nothing selected) ── */}
          {!showManualForm && searchQuery.trim().length < 2 && !hasSelected && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-14 h-14 rounded-2xl bg-orange-50 flex items-center justify-center mb-3">
                <Search className="w-6 h-6 text-orange-400" />
              </div>
              <p className="text-sm font-medium text-gray-600">Search your food history</p>
              <p className="text-xs text-gray-400 mt-1">Type a food name to find past meals</p>
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
                disabled={isSaving}
                className="px-4 py-3 border-2 border-gray-200 text-gray-600 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                ← Back
              </button>
              <button
                onClick={handleManualSave}
                disabled={isSaving}
                className="flex-1 px-4 py-3 bg-orange-500 text-white rounded-xl text-sm font-semibold hover:bg-orange-600 active:bg-orange-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSaving ? <SpinnerIcon /> : null}
                {isSaving ? "Saving…" : "Save Food"}
              </button>
            </>
          ) : hasSelected ? (
            <>
              <button
                onClick={() => setSelectedItems([])}
                disabled={isSaving}
                className="px-4 py-3 border-2 border-gray-200 text-gray-600 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Clear
              </button>
              <button
                onClick={handleAddSelected}
                disabled={isSaving}
                className="flex-1 px-4 py-3 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 active:bg-green-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSaving ? <SpinnerIcon /> : <Check className="w-4 h-4" />}
                {isSaving ? "Saving…" : `Add ${selectedItems.length} item${selectedItems.length > 1 ? "s" : ""}`}
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

const FoodItemRow = ({ item, selected, onToggle }) => (
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
      <p className="text-xs text-gray-400 mt-0.5">{item.calories ?? "?"} kcal{item.protein ? ` · ${item.protein}g protein` : ""}</p>
    </div>
  </button>
);

const MacroField = ({ label, value, onChange, placeholder, required, span }) => (
  <div className={span ? "col-span-2" : ""}>
    <label className="block text-xs font-semibold text-gray-600 mb-1">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <input
      type="number"
      inputMode="decimal"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:border-orange-400 focus:outline-none text-sm"
      style={{ fontSize: "16px" }}
    />
  </div>
);

const SpinnerIcon = () => (
  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
  </svg>
);

export default SmartFoodSearchModal;
