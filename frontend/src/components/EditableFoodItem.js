// src/components/EditableFoodItem.js
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { geminiService } from '../services/geminiService';
import { Search, Edit2, Save, X, Scale, Utensils, Flame, Beef, Wheat, Droplet } from 'lucide-react';

/**
 * Editable food item component for nutrition breakdown
 * Allows users to search and replace food items with accurate serving sizes
 */
const EditableFoodItem = ({ foodItem, onUpdate, index }) => {
  // Display/Edit mode toggle
  const [isEditing, setIsEditing] = useState(false);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedFood, setSelectedFood] = useState(null);
  
  // Serving size state
  const [currentServing, setCurrentServing] = useState(null);
  const [customGrams, setCustomGrams] = useState('');
  const [servingOptions, setServingOptions] = useState([]);
  
  // Original values for cancel
  const originalFoodRef = useRef(foodItem);
  const searchTimeoutRef = useRef(null);

  // Initialize with current food item data
  useEffect(() => {
    if (foodItem) {
      setCustomGrams(foodItem.serving?.grams || foodItem.grams || '');
    }
  }, [foodItem]);

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
    
    // Check cache first (synchronous, instant)
    const cached = geminiService.getCachedSearch(trimmed);
    if (cached) {
      console.log('✅ [EditableFoodItem] Using cached results for:', trimmed);
      setSearchResults(cached.results || []);
      setIsSearching(false);
      return;
    }
    
    // Set loading state
    setIsSearching(true);
    
    // Debounce the API call - only execute after 800ms of no typing
    searchTimeoutRef.current = setTimeout(async () => {
      console.log('🔍 [EditableFoodItem] Prefetching search for:', trimmed);
      
      try {
        const results = await geminiService.searchFood(trimmed);
        setSearchResults(results.results || []);
        console.log('✅ [EditableFoodItem] Prefetch complete, results cached');
      } catch (error) {
        console.error('❌ [EditableFoodItem] Prefetch failed:', error);
        setSearchResults([]);
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
    };
  }, []);

  // Calculate nutrition based on grams and per100g values
  const calculateNutrition = (per100g, grams) => {
    if (!per100g || !grams) return null;
    
    const multiplier = parseFloat(grams) / 100;
    
    return {
      calories: Math.round(per100g.calories * multiplier),
      protein: Math.round(per100g.protein * multiplier * 10) / 10,
      carbs: Math.round(per100g.carbs * multiplier * 10) / 10,
      fat: Math.round(per100g.fat * multiplier * 10) / 10,
      fiber: Math.round((per100g.fiber || 0) * multiplier * 10) / 10
    };
  };

  // Handle search input with prefetching
  const handleSearchInput = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    setSelectedFood(null);
    setServingOptions([]);
    
    // Trigger debounced search
    debouncedSearch(value);
  };

  // Select food from search results
  const handleFoodSelect = (food) => {
    console.log('[EditableFoodItem] Selected food:', food.name);
    setSelectedFood(food);
    setSearchQuery(food.name);
    setSearchResults([]);
    
    // Build serving options from defaultServing + servingOptions
    const options = [
      {
        description: food.defaultServing.description,
        grams: food.defaultServing.grams,
        nutrition: food.defaultServing.nutrition,
        isDefault: true
      },
      ...(food.servingOptions || []).map(opt => ({
        description: opt.description,
        grams: opt.grams,
        nutrition: opt.nutrition,
        isDefault: false
      }))
    ];
    
    setServingOptions(options);
    
    // Set default serving
    setCurrentServing(options[0]);
    setCustomGrams(options[0].grams.toString());
  };

  // Handle serving size dropdown change
  const handleServingChange = (e) => {
    const selectedIndex = parseInt(e.target.value);
    const selected = servingOptions[selectedIndex];
    
    if (selected) {
      console.log('[EditableFoodItem] Serving changed:', selected.description);
      setCurrentServing(selected);
      setCustomGrams(selected.grams.toString());
    }
  };

  // Handle custom grams input
  const handleGramsChange = (e) => {
    const value = e.target.value;
    
    // Allow only numbers and decimal point
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setCustomGrams(value);
      
      // Check if grams match any serving option
      const matchingServing = servingOptions.find(
        opt => Math.abs(opt.grams - parseFloat(value)) < 1
      );
      
      if (matchingServing) {
        console.log('[EditableFoodItem] Grams matched serving:', matchingServing.description);
        setCurrentServing(matchingServing);
      } else {
        // Custom grams - clear serving selection
        setCurrentServing(null);
      }
    }
  };

  // Save changes
  const handleSave = () => {
    if (!customGrams) {
      alert('Please specify weight in grams');
      return;
    }
    
    const grams = parseFloat(customGrams);
    if (isNaN(grams) || grams <= 0) {
      alert('Please enter valid grams (greater than 0)');
      return;
    }
    
    // Use selected food or current food item
    const foodToSave = selectedFood || {
      name: foodItem.name,
      category: foodItem.category,
      per100g: foodItem.per100g
    };
    
    // Calculate final nutrition
    const nutrition = calculateNutrition(foodToSave.per100g, grams);
    
    const updatedFood = {
      name: foodToSave.name,
      category: foodToSave.category,
      serving: {
        description: currentServing?.description || `${grams}g`,
        grams: grams
      },
      grams: grams,
      nutrition: nutrition,
      per100g: foodToSave.per100g
    };
    
    console.log('[EditableFoodItem] Saving updated food:', updatedFood);
    
    // Call parent update handler
    onUpdate(index, updatedFood);
    
    // Exit edit mode
    setIsEditing(false);
    setSearchQuery('');
    setSearchResults([]);
    setSelectedFood(null);
    setServingOptions([]);
  };

  // Cancel editing
  const handleCancel = () => {
    console.log('[EditableFoodItem] Cancelled editing');
    setIsEditing(false);
    setSearchQuery('');
    setSearchResults([]);
    setSelectedFood(null);
    setServingOptions([]);
    setCustomGrams(foodItem.serving?.grams || foodItem.grams || '');
  };

  // Enter edit mode
  const handleEdit = () => {
    console.log('[EditableFoodItem] Entering edit mode for:', foodItem.name);
    setIsEditing(true);
    
    // Pre-fill with current food data - ensure we have a valid number
    const currentGrams = parseFloat(foodItem.serving?.grams || foodItem.grams || foodItem.estimatedWeight) || 100;
    setCustomGrams(currentGrams.toString());
    setSearchQuery(foodItem.name || '');
    
    // Get nutrition values - check both nested and flat structures
    const nutritionData = foodItem.nutrition || foodItem;
    const currentCalories = nutritionData.calories || 0;
    const currentProtein = nutritionData.protein || 0;
    const currentCarbs = nutritionData.carbs || 0;
    const currentFat = nutritionData.fat || 0;
    const currentFiber = nutritionData.fiber || 0;
    
    // Calculate per100g values or use existing
    const per100gValues = foodItem.per100g || {
      calories: Math.round(currentCalories * 100 / currentGrams),
      protein: Math.round(currentProtein * 100 / currentGrams * 10) / 10,
      carbs: Math.round(currentCarbs * 100 / currentGrams * 10) / 10,
      fat: Math.round(currentFat * 100 / currentGrams * 10) / 10,
      fiber: Math.round(currentFiber * 100 / currentGrams * 10) / 10
    };
    
    // Create a mock selected food from current item for editing
    const mockFood = {
      name: foodItem.name,
      category: foodItem.category || 'Food',
      per100g: per100gValues,
      defaultServing: {
        description: foodItem.serving?.description || foodItem.portionDescription || `${currentGrams}g`,
        grams: currentGrams,
        nutrition: {
          calories: currentCalories,
          protein: currentProtein,
          carbs: currentCarbs,
          fat: currentFat,
          fiber: currentFiber
        }
      },
      servingOptions: []
    };
    
    console.log('[EditableFoodItem] Mock food created:', { 
      name: mockFood.name, 
      currentGrams, 
      per100g: mockFood.per100g,
      currentNutrition: { currentCalories, currentProtein, currentCarbs, currentFat }
    });
    
    setSelectedFood(mockFood);
    setServingOptions([mockFood.defaultServing]);
    setCurrentServing(mockFood.defaultServing);
    
    originalFoodRef.current = { ...foodItem };
  };

  // Display mode
  if (!isEditing) {
    const displayGrams = foodItem.serving?.grams || foodItem.grams || foodItem.estimatedWeight || '';
    const servingDesc = foodItem.serving?.description || foodItem.portionDescription || '';
    
    return (
      <div className="flex items-start sm:items-center justify-between py-2.5 px-3 gap-3 hover:bg-blue-50/50 rounded-lg transition-colors border-b border-gray-100 last:border-0">
        <div className="flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-1">
            <span className="font-medium text-gray-900 text-sm truncate">{foodItem.name}</span>
            {servingDesc && (
              <span className="text-xs text-blue-600 shrink-0">
                {servingDesc}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            {displayGrams && (
              <span className="text-gray-500 flex items-center gap-1">
                <Scale className="w-3 h-3" />
                {displayGrams}g
              </span>
            )}
            <span className="text-red-600 font-medium flex items-center gap-1">
              <Flame className="w-3 h-3" />
              {foodItem.nutrition?.calories || foodItem.calories || 0}
            </span>
            <span className="text-blue-600 flex items-center gap-1">
              <Beef className="w-3 h-3" />
              {foodItem.nutrition?.protein || foodItem.protein || 0}g
            </span>
            <span className="text-yellow-600 flex items-center gap-1">
              <Wheat className="w-3 h-3" />
              {foodItem.nutrition?.carbs || foodItem.carbs || 0}g
            </span>
            <span className="text-purple-600 flex items-center gap-1">
              <Droplet className="w-3 h-3" />
              {foodItem.nutrition?.fat || foodItem.fat || 0}g
            </span>
          </div>
        </div>
        <button
          onClick={handleEdit}
          className="shrink-0 px-3 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-1.5 border border-blue-200"
        >
          <Edit2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Edit</span>
        </button>
      </div>
    );
  }

  // Edit mode
  return (
    <div className="bg-blue-50/50 rounded-lg p-3 space-y-3 border border-blue-200">
      {/* Search Input */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
          <Search className="w-3.5 h-3.5 text-gray-500" />
          <span>Search Food (Optional)</span>
        </label>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchInput}
            placeholder="Search to replace..."
            className="w-full pl-9 pr-8 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSearchResults([]);
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        
        {/* Search Status */}
        {isSearching && (
          <div className="text-xs text-blue-600 flex items-center gap-1.5 mt-1.5">
            <Search className="w-3.5 h-3.5 animate-pulse" />
            <span>Searching...</span>
          </div>
        )}
        
        {searchResults.length > 0 && !isSearching && searchQuery !== foodItem.name && (
          <div className="text-xs text-green-600 mt-1.5 flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5" />
            <span>{searchResults.length} alternatives found</span>
          </div>
        )}
      </div>

      {/* Search Results Dropdown */}
      {searchResults.length > 0 && searchQuery !== foodItem.name && (
        <div className="max-h-48 overflow-y-auto border border-gray-300 rounded-lg bg-white shadow-sm">
          {searchResults.map((food, idx) => (
            <button
              key={idx}
              onClick={() => handleFoodSelect(food)}
              className="w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors border-b last:border-b-0 text-sm"
            >
              <div className="font-medium text-gray-900 mb-0.5">{food.name}</div>
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <span className="bg-gray-100 px-1.5 py-0.5 rounded">{food.category}</span>
                <span className="text-red-600 flex items-center gap-1">
                  <Flame className="w-3 h-3" />
                  {food.defaultServing.nutrition.calories}
                </span>
                <span>/ {food.defaultServing.description}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Serving Size and Grams Controls - Always visible in edit mode */}
      <div className="space-y-2.5">
        {/* Serving Size Dropdown */}
        {selectedFood && servingOptions.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
              <Utensils className="w-3.5 h-3.5 text-gray-500" />
              <span>Serving Size</span>
            </label>
            <select
              value={currentServing ? servingOptions.indexOf(currentServing) : ''}
              onChange={handleServingChange}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white"
            >
              {servingOptions.map((option, idx) => (
                <option key={idx} value={idx}>
                  {option.description} ({option.grams}g) • {option.nutrition.calories} cal
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Custom Grams Input - Always visible */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
            <Scale className="w-3.5 h-3.5 text-gray-500" />
            <span>Weight</span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={customGrams}
              onChange={handleGramsChange}
              placeholder="Enter grams"
              className="w-full px-3 py-2 pr-8 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">g</span>
          </div>
        </div>

        {/* Nutrition Preview - Always show when grams available */}
        {customGrams && selectedFood && selectedFood.per100g && (
          <div className="bg-white rounded-lg p-2.5 border border-gray-200">
            <div className="text-xs font-medium text-gray-700 mb-2 flex items-center gap-1.5">
              <Utensils className="w-3.5 h-3.5 text-gray-500" />
              <span>Preview ({customGrams}g)</span>
            </div>
            {(() => {
              const nutrition = calculateNutrition(selectedFood.per100g, parseFloat(customGrams));
              return nutrition ? (
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-red-50 rounded p-2 border border-red-100">
                    <div className="text-xs text-red-600 mb-0.5 flex items-center gap-1">
                      <Flame className="w-3 h-3" />
                      Cal
                    </div>
                    <div className="text-lg font-bold text-red-700">{nutrition.calories}</div>
                  </div>
                  <div className="bg-blue-50 rounded p-2 border border-blue-100">
                    <div className="text-xs text-blue-600 mb-0.5 flex items-center gap-1">
                      <Beef className="w-3 h-3" />
                      Protein
                    </div>
                    <div className="text-lg font-bold text-blue-700">{nutrition.protein}g</div>
                  </div>
                  <div className="bg-yellow-50 rounded p-2 border border-yellow-100">
                    <div className="text-xs text-yellow-600 mb-0.5 flex items-center gap-1">
                      <Wheat className="w-3 h-3" />
                      Carbs
                    </div>
                    <div className="text-lg font-bold text-yellow-700">{nutrition.carbs}g</div>
                  </div>
                  <div className="bg-purple-50 rounded p-2 border border-purple-100">
                    <div className="text-xs text-purple-600 mb-0.5 flex items-center gap-1">
                      <Droplet className="w-3 h-3" />
                      Fat
                    </div>
                    <div className="text-lg font-bold text-purple-700">{nutrition.fat}g</div>
                  </div>
                </div>
              ) : null;
            })()}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={!customGrams || parseFloat(customGrams) <= 0}
          className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-1.5 text-sm ${
            customGrams && parseFloat(customGrams) > 0
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          <Save className="w-4 h-4" />
          <span>Save</span>
        </button>
        <button
          onClick={handleCancel}
          className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors flex items-center justify-center gap-1.5 text-sm"
        >
          <X className="w-4 h-4" />
          <span>Cancel</span>
        </button>
      </div>
    </div>
  );
};

export default EditableFoodItem;
