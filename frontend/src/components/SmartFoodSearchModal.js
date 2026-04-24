// src/components/SmartFoodSearchModal.js
import React, { useState, useEffect, useRef } from "react";
import { X, Search, Trash2 } from "lucide-react";

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
  altSwitchButtons,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [myPlates, setMyPlates] = useState([]);
  const [communityPlates, setCommunityPlates] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [selectedPlate, setSelectedPlate] = useState(null); // full plate chosen
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [removedFoodIndices, setRemovedFoodIndices] = useState(new Set()); // indices removed from selectedPlate

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
      setSearchQuery("");
      setMyPlates([]);
      setCommunityPlates([]);
      setShowManualForm(false);
      setSelectedPlate(null);
      setRemovedFoodIndices(new Set());
      setError("");
      resetManualForm();
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Debounced search
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setMyPlates([]);
      setCommunityPlates([]);
      return;
    }
    searchTimerRef.current = setTimeout(() => {
      performSearch(searchQuery.trim());
    }, 350);
    return () => clearTimeout(searchTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const performSearch = async (query) => {
    if (!userId || !apiBaseUrl) return;
    setIsSearching(true);
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/search-food-history?userId=${encodeURIComponent(userId)}&query=${encodeURIComponent(query)}`
      );
      const data = await res.json();
      if (data.success) {
        setMyPlates(data.myPlates || []);
        setCommunityPlates(data.communityPlates || []);
      } else {
        setMyPlates([]);
        setCommunityPlates([]);
      }
    } catch {
      setMyPlates([]);
      setCommunityPlates([]);
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

  const handleSelectPlate = (plate) => {
    setSelectedPlate(plate);
    setRemovedFoodIndices(new Set());
    setShowManualForm(false);
    setError("");
  };

  const handleRemovePlateFood = (index) => {
    setRemovedFoodIndices(prev => {
      const next = new Set(prev);
      next.has(index) ? next.delete(index) : next.add(index);
      return next;
    });
  };

  const handleConfirmPlate = async () => {
    if (!selectedPlate) return;
    setError("");
    const activeFoods = selectedPlate.foods.filter((_, i) => !removedFoodIndices.has(i));
    if (activeFoods.length === 0) {
      setError("Add at least one food item");
      return;
    }
    const liveTotal = activeFoods.reduce((acc, f) => ({
      calories: (acc.calories || 0) + (f.calories || 0),
      protein: (acc.protein || 0) + (f.protein || 0),
      carbs: (acc.carbs || 0) + (f.carbs || 0),
      fat: (acc.fat || 0) + (f.fat || 0),
      fiber: (acc.fiber || 0) + (f.fiber || 0),
    }), {});
    setIsSaving(true);
    try {
      await onSave({
        items: activeFoods,
        total: liveTotal,
        isPlate: true,
        plateName: selectedPlate.title,
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
    setSearchQuery("");
    setMyPlates([]);
    setCommunityPlates([]);
    setShowManualForm(false);
    setSelectedPlate(null);
    setError("");
    resetManualForm();
    onClose();
  };

  if (!isOpen) return null;

  const hasMyPlates = myPlates.length > 0;
  const hasCommunityPlates = communityPlates.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[90vh] flex flex-col">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2.5 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="text-sm font-bold text-gray-900">
              AI Temporarily Unavailable
            </h2>
            <p className="text-xs text-gray-400">Enter your meal details manually</p>
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

          {/* ── Plate confirmation ── */}
          {selectedPlate && !showManualForm && (() => {
            const activeFoods = selectedPlate.foods.filter((_, i) => !removedFoodIndices.has(i));
            const liveTotal = activeFoods.reduce((acc, f) => ({
              calories: (acc.calories || 0) + (f.calories || 0),
              protein: (acc.protein || 0) + (f.protein || 0),
              carbs: (acc.carbs || 0) + (f.carbs || 0),
              fat: (acc.fat || 0) + (f.fat || 0),
            }), {});
            return (
              <div className="bg-green-50 border-2 border-green-300 rounded-2xl p-4">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800">🍽 {selectedPlate.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {activeFoods.length} of {selectedPlate.foods.length} items · {liveTotal.calories} kcal
                    </p>
                  </div>
                  <button onClick={() => setSelectedPlate(null)} className="text-gray-400 hover:text-gray-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-[11px] text-gray-400 mb-2">Tap 🗑 to remove items you didn't have</p>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {selectedPlate.foods.map((f, i) => {
                    const removed = removedFoodIndices.has(i);
                    return (
                      <div
                        key={i}
                        className={`flex items-center justify-between rounded-xl px-3 py-1.5 border transition-colors ${
                          removed ? "bg-gray-50 border-gray-200 opacity-50" : "bg-white border-green-100"
                        }`}
                      >
                        <p className={`text-xs font-medium truncate flex-1 ${removed ? "line-through text-gray-400" : "text-gray-700"}`}>
                          {f.name}
                        </p>
                        <p className="text-xs text-gray-400 ml-2 flex-shrink-0">{f.calories ?? "?"} kcal</p>
                        <button
                          onClick={() => handleRemovePlateFood(i)}
                          className={`ml-2 flex-shrink-0 rounded-full p-0.5 transition-colors ${
                            removed ? "text-green-500 hover:text-green-600" : "text-red-400 hover:text-red-600"
                          }`}
                        >
                          {removed ? (
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                            </svg>
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div className="grid grid-cols-4 gap-2 mt-3">
                  {[
                    { label: "kcal", value: liveTotal.calories },
                    { label: "protein", value: `${liveTotal.protein}g` },
                    { label: "carbs", value: `${liveTotal.carbs}g` },
                    { label: "fat", value: `${liveTotal.fat}g` },
                  ].map((m) => (
                    <div key={m.label} className="bg-white rounded-xl px-2 py-2 text-center border border-green-100">
                      <p className="text-sm font-bold text-green-700">{m.value}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{m.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* ── Search results ── */}
          {!showManualForm && !selectedPlate && searchQuery.trim().length >= 2 && (
            <div className="space-y-4">
              {/* My plates */}
              {hasMyPlates && (
                <div>
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5 px-1">📌 My History</p>
                  <div className="space-y-2">
                    {myPlates.map((plate) => (
                      <PlateCard key={plate.mealId} plate={plate} onSelect={handleSelectPlate} />
                    ))}
                  </div>
                </div>
              )}

              {/* Community plates */}
              {hasCommunityPlates && (
                <div>
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5 px-1">🌐 Community</p>
                  <div className="space-y-2">
                    {communityPlates.map((plate) => (
                      <PlateCard key={plate.mealId} plate={plate} onSelect={handleSelectPlate} />
                    ))}
                  </div>
                </div>
              )}

              {/* No results */}
              {!isSearching && !hasMyPlates && !hasCommunityPlates && (
                <p className="text-sm text-gray-400 text-center py-4">No meals found — try adding manually</p>
              )}
            </div>
          )}

          {/* ── Empty state ── */}
          {!showManualForm && !selectedPlate && searchQuery.trim().length < 2 && (
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
          ) : selectedPlate ? (
            <>
              <button
                onClick={() => setSelectedPlate(null)}
                disabled={isSaving}
                className="px-4 py-3 border-2 border-gray-200 text-gray-600 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                ← Back
              </button>
              <button
                onClick={handleConfirmPlate}
                disabled={isSaving}
                className="flex-1 px-4 py-3 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 active:bg-green-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSaving ? <SpinnerIcon /> : null}
                {isSaving ? "Saving…" : `Add plate (${selectedPlate.foods.length - removedFoodIndices.size} items)`}
              </button>
            </>
          ) : (
            <button
              onClick={handleClose}
              className="flex-1 px-4 py-3 border-2 border-gray-200 text-gray-600 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>

        {/* Wrong type strip */}
        {altSwitchButtons?.length > 0 && (
          <div className="flex items-center gap-2 px-4 pb-3">
            <span className="text-xs text-gray-400 whitespace-nowrap">Not food?</span>
            <div className="flex gap-1.5 flex-1">
              {altSwitchButtons.map((btn) => (
                <button
                  key={btn.label}
                  onClick={btn.onClick}
                  className="flex-1 flex items-center justify-center gap-1 border border-gray-200 bg-white hover:bg-gray-50 text-gray-500 py-1.5 rounded-full text-xs font-medium transition-colors"
                >
                  <span>{btn.icon}</span>
                  <span>{btn.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

// ── Sub-components ──────────────────────────────────────────────────────────

const PlateCard = ({ plate, onSelect }) => (
  <button
    onClick={() => onSelect(plate)}
    className="w-full text-left bg-white border border-gray-200 hover:border-orange-300 hover:bg-orange-50 rounded-2xl overflow-hidden transition-colors shadow-sm"
  >
    <div className="flex items-center justify-between px-4 pt-3 pb-2">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 truncate">{plate.title}</p>
        <p className="text-xs text-gray-400 mt-0.5">{plate.foods.length} items · {plate.total?.calories ?? "?"} kcal</p>
      </div>
      <span className="text-xs text-orange-500 ml-3 flex-shrink-0 font-semibold">Add all ›</span>
    </div>
    <div className="px-4 pb-3 flex flex-wrap gap-1">
      {plate.foods.slice(0, 6).map((f, i) => (
        <span key={i} className="text-[11px] bg-gray-100 text-gray-600 rounded-full px-2.5 py-0.5">{f.name}</span>
      ))}
      {plate.foods.length > 6 && (
        <span className="text-[11px] bg-gray-100 text-gray-400 rounded-full px-2.5 py-0.5">+{plate.foods.length - 6} more</span>
      )}
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
