// useNutritionAnalysis — owns the currently-selected meal's editable items,
// editing-state tracking, and per-row update/delete/restore (with persistence).
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  parseAnalysisData, recalculateTotals, transformDbItemToEditable,
  persistMealItems as persistMealItemsService,
} from '../services/nutritionDashboard';

const sig = (item) => {
  const name  = (item?.name || '').trim().toLowerCase();
  const grams = item?.serving?.grams ?? item?.grams ?? item?.estimatedWeight ?? '';
  const unit  = (item?.serving?.unit || item?.unit || '').trim().toLowerCase();
  return `${name}::${grams}::${unit}`;
};
const resolveItemIndex = (items, fallbackIndex, snapshot) => {
  if (snapshot) {
    const s = sig(snapshot);
    const i = items.findIndex((it) => sig(it) === s);
    if (i !== -1) return i;
  }
  return fallbackIndex >= 0 && fallbackIndex < items.length ? fallbackIndex : -1;
};

export function useNutritionAnalysis({
  apiBaseUrl, selectedMeal, setSelectedMeal, setAnalyses,
  resolveUserId, refresh, selectedDate,
}) {
  const [localDetailedItems, setLocalDetailedItems] = useState([]);
  const [localNutrition, setLocalNutrition]         = useState({});
  const [editingStates, setEditingStates]           = useState({});
  const [isEditing, setIsEditing]                   = useState(false);
  const [editingIndex, setEditingIndex]             = useState(null);
  const [isSaving, setIsSaving]                     = useState(false);
  const [saveStatus, setSaveStatus]                 = useState(null);
  const [resetKey, setResetKey]                     = useState(0);
  const itemRefs            = useRef({});
  const isAutoSaveUpdateRef = useRef(false);

  // Load editable items whenever the selected meal changes.
  useEffect(() => {
    if (!selectedMeal) return;
    const foodData = parseAnalysisData(selectedMeal.AnalysisData);
    setLocalDetailedItems((foodData.detailedItems || []).map((it) => transformDbItemToEditable(it, true)));
    setLocalNutrition(foodData.nutrition || {});
    if (!isAutoSaveUpdateRef.current) { setIsEditing(false); setEditingStates({}); }
    isAutoSaveUpdateRef.current = false;
  }, [selectedMeal]);

  useEffect(() => {
    const anyEditing = Object.values(editingStates).some((s) => s === true);
    setIsEditing(anyEditing);
    if (anyEditing) {
      const idx = Object.keys(editingStates).find((k) => editingStates[k]);
      setEditingIndex(idx !== undefined ? parseInt(idx) : null);
    } else { setEditingIndex(null); }
  }, [editingStates]);

  const handleEditingChange = useCallback((index, isItemEditing, isBlocking = false) => {
    setEditingStates((prev) => ({ ...prev, [index]: isItemEditing }));
    setIsSaving(isBlocking);
  }, []);

  const persistMealItems = useCallback(async (newItems, newTotals, options = {}) => {
    if (!selectedMeal?.ID) return;
    const { syncSelectedMeal = true, refreshStats = true } = options;
    setIsSaving(true);
    try {
      const userId = await resolveUserId();
      if (!userId) throw new Error('User not authenticated or not found in database');
      await persistMealItemsService({
        apiBaseUrl, mealId: selectedMeal.ID, userId, newItems, newTotals,
        setAnalyses, syncSelectedMeal, setSelectedMeal,
        refresh: refreshStats ? refresh : null, selectedDate,
        markAutoSave: () => { isAutoSaveUpdateRef.current = true; },
      });
    } finally { setIsSaving(false); }
  }, [apiBaseUrl, selectedMeal, resolveUserId, refresh, selectedDate, setAnalyses, setSelectedMeal]);

  const handleFoodUpdate = useCallback(async (index, updatedFood) => {
    const newItems = [...localDetailedItems]; newItems[index] = updatedFood;
    setLocalDetailedItems(newItems);
    const newTotals = recalculateTotals(newItems);
    setLocalNutrition(newTotals);
    await persistMealItems(newItems, newTotals);
  }, [localDetailedItems, persistMealItems]);

  const handleDeleteFoodItem = useCallback(async (index, options = {}) => {
    const phase = options?.phase || 'finalize';
    const snapshot = options?.itemSnapshot || null;
    if (!Array.isArray(localDetailedItems) || localDetailedItems.length === 0) return;
    const targetIndex = resolveItemIndex(localDetailedItems, index, snapshot);
    if (targetIndex === -1) return;
    const previousTotals = localNutrition;
    const newItems = localDetailedItems.filter((_, i) => i !== targetIndex);
    const newTotals = recalculateTotals(newItems);
    if (phase === 'immediate') {
      setLocalNutrition(newTotals);
      try { await persistMealItems(newItems, newTotals, { syncSelectedMeal: false, refreshStats: false }); }
      catch (e) { setLocalNutrition(previousTotals); throw e; }
      return;
    }
    setLocalDetailedItems(newItems); setLocalNutrition(newTotals);
  }, [localDetailedItems, localNutrition, persistMealItems]);

  const handleRestoreFoodItem = useCallback(async (index, snapshot) => {
    const previousItems = localDetailedItems;
    const previousTotals = localNutrition;
    let restoreItems = localDetailedItems;
    const existingIndex = resolveItemIndex(localDetailedItems, index, snapshot);
    if (existingIndex === -1 && snapshot) {
      const insertAt = Math.max(0, Math.min(index, localDetailedItems.length));
      restoreItems = [...localDetailedItems.slice(0, insertAt), snapshot, ...localDetailedItems.slice(insertAt)];
      setLocalDetailedItems(restoreItems);
    }
    const restoreTotals = recalculateTotals(restoreItems);
    setLocalNutrition(restoreTotals);
    try { await persistMealItems(restoreItems, restoreTotals); }
    catch (e) { setLocalDetailedItems(previousItems); setLocalNutrition(previousTotals); throw e; }
  }, [localDetailedItems, localNutrition, persistMealItems]);

  const handleCloseEditing = useCallback(async () => {
    setIsSaving(true);
    try {
      const promises = Object.keys(itemRefs.current).map((index) => {
        const ref = itemRefs.current[index];
        if (ref && editingStates[index] && ref.save) return ref.save();
        return Promise.resolve();
      });
      await Promise.all(promises);
    } catch (e) { console.error('Error saving items:', e); }
    finally { setIsSaving(false); }
    setIsEditing(false); setEditingStates({}); setEditingIndex(null);
  }, [editingStates]);

  const handleCancelEditing = useCallback(() => {
    if (!selectedMeal) return;
    const foodData = parseAnalysisData(selectedMeal.AnalysisData);
    setLocalDetailedItems((foodData.detailedItems || []).map((it) => transformDbItemToEditable(it, false)));
    setLocalNutrition(foodData.nutrition || {});
    setIsEditing(false); setEditingStates({}); setEditingIndex(null);
    setResetKey((k) => k + 1);
  }, [selectedMeal]);

  return {
    localDetailedItems, localNutrition, editingStates, isEditing, editingIndex,
    isSaving, saveStatus, setSaveStatus, resetKey, itemRefs,
    handleEditingChange, handleFoodUpdate, handleDeleteFoodItem,
    handleRestoreFoodItem, handleCloseEditing, handleCancelEditing,
  };
}
