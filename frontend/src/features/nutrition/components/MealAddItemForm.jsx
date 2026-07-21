/**
 * MealAddItemForm — reusable "Add Item" UI for existing meals.
 *
 * Extracted from NutritionCard so the diary food modal (NutritionAnalysisPanel)
 * and capture review card share the same manual-add flow: food search,
 * quantity + unit, macros/GI recalculation via persist callback.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getUserId } from '../../../shared/services/userIdentity';
import { searchFoods } from '../services/foodCorrectionService';
import {
  buildManualFoodItem,
  calculateNutritionFromSearchResult,
  resolveFoodSearchResult,
} from '../services/nutritionDashboard/mealAddItemHelpers';

export default function MealAddItemForm({
  user,
  disabled = false,
  isSaving = false,
  onAdd,
  compact = false,
  layout = 'inline',
  footerExtra = null,
}) {
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemPortion, setNewItemPortion] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState('100');
  const [newItemUnit, setNewItemUnit] = useState('g');
  const [addItemError, setAddItemError] = useState('');
  const [selectedAddFood, setSelectedAddFood] = useState(null);
  const [addSearchResults, setAddSearchResults] = useState([]);
  const [showAddSuggestions, setShowAddSuggestions] = useState(false);
  const [isAddSearching, setIsAddSearching] = useState(false);
  const [activeAddSuggestionIndex, setActiveAddSuggestionIndex] = useState(-1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const addSearchTimeoutRef = useRef(null);

  useEffect(() => () => {
    if (addSearchTimeoutRef.current) clearTimeout(addSearchTimeoutRef.current);
  }, []);

  const resetAddItemForm = useCallback(() => {
    if (addSearchTimeoutRef.current) {
      clearTimeout(addSearchTimeoutRef.current);
      addSearchTimeoutRef.current = null;
    }
    setIsAddingItem(false);
    setNewItemName('');
    setNewItemPortion('');
    setNewItemQuantity('100');
    setNewItemUnit('g');
    setAddItemError('');
    setSelectedAddFood(null);
    setAddSearchResults([]);
    setShowAddSuggestions(false);
    setIsAddSearching(false);
    setActiveAddSuggestionIndex(-1);
  }, []);

  const handleSelectAddSuggestion = (food) => {
    setSelectedAddFood(food);
    setNewItemName(food?.name || '');
    if (!newItemPortion && food?.defaultServing?.description) {
      setNewItemPortion(food.defaultServing.description);
    }
    setShowAddSuggestions(false);
    setAddSearchResults([]);
    setActiveAddSuggestionIndex(-1);
  };

  const handleAddNameChange = (value) => {
    setNewItemName(value);
    setSelectedAddFood(null);
    setAddItemError('');
    setActiveAddSuggestionIndex(-1);

    const trimmed = value.trim();
    if (addSearchTimeoutRef.current) {
      clearTimeout(addSearchTimeoutRef.current);
      addSearchTimeoutRef.current = null;
    }

    if (!trimmed) {
      setShowAddSuggestions(false);
      setAddSearchResults([]);
      setIsAddSearching(false);
      return;
    }

    setShowAddSuggestions(true);
    setIsAddSearching(true);
    addSearchTimeoutRef.current = setTimeout(async () => {
      try {
        const uid = user?.id || (await getUserId(user).catch(() => null));
        const results = await searchFoods(trimmed, uid);
        setAddSearchResults(results || []);
      } catch (error) {
        console.error('[MealAddItemForm] Add item search failed:', error);
        setAddSearchResults([]);
      } finally {
        setIsAddSearching(false);
        addSearchTimeoutRef.current = null;
      }
    }, 400);
  };

  const handleAddNameKeyDown = (e) => {
    if (!showAddSuggestions || addSearchResults.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveAddSuggestionIndex((prev) =>
        prev < addSearchResults.length - 1 ? prev + 1 : 0,
      );
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveAddSuggestionIndex((prev) =>
        prev > 0 ? prev - 1 : addSearchResults.length - 1,
      );
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (activeAddSuggestionIndex >= 0) {
        handleSelectAddSuggestion(addSearchResults[activeAddSuggestionIndex]);
      }
      return;
    }

    if (e.key === 'Escape') {
      setShowAddSuggestions(false);
      setActiveAddSuggestionIndex(-1);
    }
  };

  const handleAddMissingItem = async () => {
    setAddItemError('');
    const trimmedName = newItemName.trim();
    if (!trimmedName) {
      setAddItemError('Food name is required');
      return;
    }

    const parsedQuantity = parseFloat(newItemQuantity);
    const quantity =
      Number.isFinite(parsedQuantity) && parsedQuantity > 0 ? parsedQuantity : 100;

    setIsSubmitting(true);
    try {
      let selectedFoodResult = selectedAddFood;
      if (!selectedFoodResult) {
        try {
          selectedFoodResult = await resolveFoodSearchResult(trimmedName, user);
        } catch (error) {
          console.error('[MealAddItemForm] Nutrition lookup failed:', error);
          setAddItemError('Unable to fetch nutrition. Please try again.');
          return;
        }
      }

      const nutritionValues = calculateNutritionFromSearchResult(
        selectedFoodResult,
        quantity,
      );

      if (!selectedFoodResult || !nutritionValues) {
        setAddItemError('No nutrition data found for this item. Try a specific name.');
        return;
      }

      const portionText =
        newItemPortion.trim() ||
        `${Math.round(quantity)}${newItemUnit} ${trimmedName}`.trim();

      const newItem = buildManualFoodItem({
        trimmedName,
        quantity,
        unit: newItemUnit,
        portionText,
        selectedFoodResult,
        nutritionValues,
      });

      await onAdd(newItem);
      resetAddItemForm();
    } catch (error) {
      console.error('[MealAddItemForm] Add item save failed:', error);
      setAddItemError(error.message || 'Failed to save item');
    } finally {
      setIsSubmitting(false);
    }
  };

  const blocked = disabled || isSaving || isSubmitting;
  const isFooterLayout = layout === 'footer';

  const formFields = isAddingItem ? (
    <div className={`${isFooterLayout ? 'mb-3' : 'mb-4'} p-3 rounded-xl border border-gray-200 bg-gray-50`}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="relative md:col-span-2">
          <input
            type="text"
            placeholder="Food name"
            value={newItemName}
            onChange={(e) => handleAddNameChange(e.target.value)}
            onKeyDown={handleAddNameKeyDown}
            onFocus={() => {
              if (newItemName.trim().length > 0) setShowAddSuggestions(true);
            }}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
          />
          {isAddSearching && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
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
                      ? 'bg-green-100'
                      : 'hover:bg-green-50'
                  }`}
                >
                  <div className="text-sm font-medium text-gray-900">{food.name}</div>
                </button>
              ))}
            </div>
          )}
        </div>
        <input
          type="text"
          inputMode="decimal"
          pattern="[0-9]*"
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
    </div>
  ) : null;

  const openAddForm = () => {
    setAddItemError('');
    setIsAddingItem(true);
  };

  const addItemButton = (
    <button
      type="button"
      onClick={openAddForm}
      disabled={blocked}
      className={
        isFooterLayout
          ? 'flex-1 flex items-center justify-center gap-2 rounded-xl text-white text-sm font-semibold px-4 py-3 shadow-sm bg-green-500 hover:bg-green-600 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed'
          : 'px-3 py-1.5 text-xs font-semibold rounded-full bg-green-500 text-white hover:bg-green-600 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shrink-0'
      }
    >
      + Add Item
    </button>
  );

  const cancelAddButton = (
    <button
      type="button"
      onClick={resetAddItemForm}
      disabled={isSubmitting}
      className={
        isFooterLayout
          ? 'flex-1 flex items-center justify-center gap-2 rounded-xl text-gray-700 text-sm font-semibold px-4 py-3 shadow-sm bg-gray-100 border border-gray-200 hover:bg-gray-200 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed'
          : 'px-3 py-1.5 text-xs font-semibold rounded-full bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shrink-0'
      }
    >
      Cancel
    </button>
  );

  if (isFooterLayout) {
    return (
      <div className="p-4 border-t border-gray-100 shrink-0 bg-white space-y-3">
        {formFields}
        {isAddingItem ? (
          <div className="flex gap-3">
            {cancelAddButton}
            <button
              type="button"
              onClick={handleAddMissingItem}
              disabled={blocked}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl text-white text-sm font-semibold px-4 py-3 shadow-sm bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Saving…' : 'Save Item'}
            </button>
          </div>
        ) : null}
        <div className="flex gap-3">
          {isAddingItem ? null : addItemButton}
          {footerExtra}
        </div>
      </div>
    );
  }

  return (
    <div className={compact ? 'mb-3' : 'mt-5 pt-5 border-t border-gray-100'}>
      <div className="flex items-center justify-between mb-3 gap-2">
        {!compact && (
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <span className="w-1 h-5 rounded-full bg-green-500 inline-block" />
            Food Breakdown
          </h3>
        )}
        {compact && (
          <h3 className="font-semibold text-gray-900 text-sm">Food Items</h3>
        )}
        {isAddingItem ? cancelAddButton : addItemButton}
      </div>

      {formFields}
      {isAddingItem && !isFooterLayout && (
        <div className="mt-3 flex gap-3 justify-end">
          {cancelAddButton}
          <button
            type="button"
            onClick={handleAddMissingItem}
            disabled={blocked}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Saving…' : 'Save Item'}
          </button>
        </div>
      )}
    </div>
  );
}
