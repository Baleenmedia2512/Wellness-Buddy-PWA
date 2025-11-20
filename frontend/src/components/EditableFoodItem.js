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
  const [searchError, setSearchError] = useState(null);
  const [selectedFood, setSelectedFood] = useState(null);
  
  // Serving size state
  const [currentServing, setCurrentServing] = useState(null);
  const [currentServingIndex, setCurrentServingIndex] = useState(0);
  const [customGrams, setCustomGrams] = useState('');
  const [servingOptions, setServingOptions] = useState([]);
  const [isServingDropdownOpen, setIsServingDropdownOpen] = useState(false);
  
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
    
    // Clear previous errors when user types
    setSearchError(null);
    
    // Check cache first (synchronous, instant)
    const cached = geminiService.getCachedSearch(trimmed);
    if (cached) {
      console.log('✅ [EditableFoodItem] Using cached results for:', trimmed);
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
      console.log('🔍 [EditableFoodItem] Searching for:', trimmed);
      
      try {
        const results = await geminiService.searchFood(trimmed);
        setSearchResults(results.results || []);
        setSearchError(null);
        console.log('✅ [EditableFoodItem] Search complete, results cached');
      } catch (error) {
        console.error('❌ [EditableFoodItem] Search failed:', error);
        
        // Preserve existing results, show user-friendly error
        setSearchResults([]);
        
        // Determine error type and set appropriate message
        if (error.message?.includes('429') || error.message?.includes('Resource exhausted')) {
          setSearchError('Search limit reached. Please try again in a moment.');
        } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
          setSearchError('Network error. Please check your connection.');
        } else {
          setSearchError('Search failed. You can still edit the current food.');
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
    };
  }, []);

  // Generate dynamic serving options based on detected quantity
  const generateServingOptions = (baseServing, per100g, itemName, portionDesc) => {
    const options = [];
    
    // Extract quantity from portion description - handles fractions, whole numbers, and numbers-only
    // Examples: "2 idlis", "1/2 cup", "1 1/2 bowls", "3 chapatis", "3"
    let detectedQuantity = 1;
    let itemUnit = itemName.toLowerCase();
    
    // Try to match fraction pattern (e.g., "1/2 cup", "1 1/2 bowls")
    const fractionMatch = portionDesc.match(/(\d+)?\s*(\d+)\/(\d+)\s*([a-zA-Z]+)/);
    if (fractionMatch) {
      const whole = fractionMatch[1] ? parseInt(fractionMatch[1]) : 0;
      const numerator = parseInt(fractionMatch[2]);
      const denominator = parseInt(fractionMatch[3]);
      detectedQuantity = whole + (numerator / denominator);
      itemUnit = fractionMatch[4];
    } else {
      // Try to match whole number with unit (e.g., "2 idlis", "3 chapatis")
      const wholeMatch = portionDesc.match(/(\d+)\s*([a-zA-Z]+)/);
      if (wholeMatch) {
        detectedQuantity = parseInt(wholeMatch[1]);
        itemUnit = wholeMatch[2];
      } else {
        // Try to match number-only (e.g., "3")
        const numberOnlyMatch = portionDesc.match(/^\d+$/);
        if (numberOnlyMatch) {
          detectedQuantity = parseInt(portionDesc);
          // itemUnit already set to itemName.toLowerCase()
        }
      }
    }
    
    // For fractions, generate options in fraction increments
    // For whole numbers, generate integer increments
    const isFraction = detectedQuantity < 1 || detectedQuantity % 1 !== 0;
    const maxMultiplier = detectedQuantity * 2;
    
    if (isFraction) {
      // Generate fractional options (e.g., 1/2, 1, 1 1/2, 2)
      const increment = detectedQuantity; // Use the fraction as increment
      for (let qty = increment; qty <= maxMultiplier; qty += increment) {
        const multiplier = qty / detectedQuantity;
        const gramsForQty = Math.round(baseServing.grams * multiplier);
        const nutritionMultiplier = gramsForQty / 100;
        
        // Format fraction display
        let qtyDisplay;
        if (qty < 1) {
          // Pure fraction like 1/2
          const denom = Math.round(1 / qty);
          qtyDisplay = `1/${denom}`;
        } else if (qty % 1 === 0) {
          // Whole number
          qtyDisplay = qty.toString();
        } else {
          // Mixed fraction like 1 1/2
          const whole = Math.floor(qty);
          const frac = qty - whole;
          const denom = Math.round(1 / frac);
          qtyDisplay = `${whole} 1/${denom}`;
        }
        
        options.push({
          description: Math.abs(qty - detectedQuantity) < 0.01
            ? `${qtyDisplay} ${itemUnit} (original)` 
            : `${qtyDisplay} ${itemUnit}`,
          grams: gramsForQty,
          nutrition: {
            calories: Math.round(per100g.calories * nutritionMultiplier),
            protein: Math.ceil(per100g.protein * nutritionMultiplier),
            carbs: Math.ceil(per100g.carbs * nutritionMultiplier),
            fat: Math.ceil(per100g.fat * nutritionMultiplier),
            fiber: Math.ceil((per100g.fiber || 0) * nutritionMultiplier)
          },
          isOriginal: Math.abs(qty - detectedQuantity) < 0.01
        });
      }
    } else {
      // Generate whole number options (e.g., 1, 2, 3, 4)
      for (let qty = 1; qty <= maxMultiplier; qty++) {
        const multiplier = qty / detectedQuantity;
        const gramsForQty = Math.round(baseServing.grams * multiplier);
        const nutritionMultiplier = gramsForQty / 100;
        
        options.push({
          description: qty === detectedQuantity 
            ? `${qty} ${itemUnit} (original)` 
            : `${qty} ${itemUnit}`,
          grams: gramsForQty,
          nutrition: {
            calories: Math.round(per100g.calories * nutritionMultiplier),
            protein: Math.ceil(per100g.protein * nutritionMultiplier),
            carbs: Math.ceil(per100g.carbs * nutritionMultiplier),
            fat: Math.ceil(per100g.fat * nutritionMultiplier),
            fiber: Math.ceil((per100g.fiber || 0) * nutritionMultiplier)
          },
          isOriginal: qty === detectedQuantity
        });
      }
    }
    
    return options;
  };

  // Calculate nutrition based on grams and per100g values
  const calculateNutrition = (per100g, grams) => {
    if (!per100g || !grams) return null;
    
    const multiplier = parseFloat(grams) / 100;
    
    return {
      calories: Math.round(per100g.calories * multiplier),
      protein: Math.ceil(per100g.protein * multiplier),
      carbs: Math.ceil(per100g.carbs * multiplier),
      fat: Math.ceil(per100g.fat * multiplier),
      fiber: Math.ceil((per100g.fiber || 0) * multiplier)
    };
  };

  // Handle search input with prefetching
  const handleSearchInput = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    setSelectedFood(null);
    setServingOptions([]);
    setSearchError(null); // Clear errors when typing
    
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
    setCurrentServingIndex(0);
    setCustomGrams(options[0].grams.toString());
  };

  // Handle serving size dropdown change
  const handleServingChange = (e) => {
    const selectedIndex = parseInt(e.target.value);
    const selected = servingOptions[selectedIndex];
    
    if (selected) {
      console.log('[EditableFoodItem] Serving changed:', selected.description);
      setCurrentServing(selected);
      setCurrentServingIndex(selectedIndex);
      setCustomGrams(selected.grams.toString());
    }
  };

  // Handle custom grams input
  const handleGramsChange = (e) => {
    const value = e.target.value;
    
    // Allow only numbers and decimal point
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setCustomGrams(value);
      
      const gramsValue = parseFloat(value);
      
      if (!isNaN(gramsValue) && servingOptions.length > 0) {
        // Find the maximum grams in serving options
        const maxServingIndex = servingOptions.reduce((maxIdx, opt, idx) => 
          opt.grams > servingOptions[maxIdx].grams ? idx : maxIdx
        , 0);
        const maxServing = servingOptions[maxServingIndex];
        
        // Check if grams exactly match any serving option (within 1g tolerance)
        const exactMatchIndex = servingOptions.findIndex(
          opt => Math.abs(opt.grams - gramsValue) < 1
        );
        
        if (exactMatchIndex !== -1) {
          // Exact match found
          console.log('[EditableFoodItem] Grams matched serving:', servingOptions[exactMatchIndex].description);
          setCurrentServing(servingOptions[exactMatchIndex]);
          setCurrentServingIndex(exactMatchIndex);
        } else if (gramsValue >= maxServing.grams) {
          // If typed grams exceeds max serving, auto-select max serving and cap the weight
          console.log('[EditableFoodItem] Grams exceeds max, selecting:', maxServing.description);
          setCurrentServing(maxServing);
          setCurrentServingIndex(maxServingIndex);
          setCustomGrams(maxServing.grams.toString());
        } else {
          // Find closest serving option for display, but keep custom grams for calculation
          const closestIndex = servingOptions.reduce((closestIdx, opt, idx) => {
            const currentDiff = Math.abs(servingOptions[closestIdx].grams - gramsValue);
            const newDiff = Math.abs(opt.grams - gramsValue);
            return newDiff < currentDiff ? idx : closestIdx;
          }, 0);
          
          console.log('[EditableFoodItem] Custom grams, showing closest serving:', servingOptions[closestIndex].description);
          setCurrentServing(servingOptions[closestIndex]);
          setCurrentServingIndex(closestIndex);
          // Keep the custom typed value for calculations
        }
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
    setSearchError(null);
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
      protein: Math.ceil(currentProtein * 100 / currentGrams),
      carbs: Math.ceil(currentCarbs * 100 / currentGrams),
      fat: Math.ceil(currentFat * 100 / currentGrams),
      fiber: Math.ceil(currentFiber * 100 / currentGrams)
    };

    
    const portionDesc = foodItem.serving?.description || foodItem.portionDescription || `${currentGrams}g`;
    
    // Create base serving
    const baseServing = {
      description: portionDesc,
      grams: currentGrams,
      nutrition: {
        calories: currentCalories,
        protein: currentProtein,
        carbs: currentCarbs,
        fat: currentFat,
        fiber: currentFiber
      }
    };
    
    // Generate dynamic serving options based on detected quantity
    const dynamicOptions = generateServingOptions(
      baseServing, 
      per100gValues, 
      foodItem.name,
      portionDesc
    );
    
    // Create a mock selected food from current item for editing
    const mockFood = {
      name: foodItem.name,
      category: foodItem.category || 'Food',
      per100g: per100gValues,
      defaultServing: baseServing,
      servingOptions: dynamicOptions.slice(1) // Exclude first option as it's the default
    };
    
    console.log('[EditableFoodItem] Mock food created:', { 
      name: mockFood.name, 
      currentGrams, 
      per100g: mockFood.per100g,
      servingOptionsCount: dynamicOptions.length,
      currentNutrition: { currentCalories, currentProtein, currentCarbs, currentFat }
    });
    
    setSelectedFood(mockFood);
    setServingOptions(dynamicOptions); // Use all dynamic options including the original
    
    // Find and set the original serving as current
    const originalIndex = dynamicOptions.findIndex(opt => opt.isOriginal);
    const originalServing = originalIndex !== -1 ? dynamicOptions[originalIndex] : dynamicOptions[0];
    const originalIndexFinal = originalIndex !== -1 ? originalIndex : 0;
    
    setCurrentServing(originalServing);
    setCurrentServingIndex(originalIndexFinal);
    
    originalFoodRef.current = { ...foodItem };
  };

  // Display mode
  if (!isEditing) {
    const displayGrams = foodItem.serving?.grams || foodItem.grams || foodItem.estimatedWeight || '';
    let servingDesc = foodItem.serving?.description || foodItem.portionDescription || '';
    
    // If servingDesc is just a number, construct a proper description
    if (servingDesc && /^\d+$/.test(servingDesc.trim())) {
      // Just a number like "3", add the food name or "pieces"
      const itemName = foodItem.name.toLowerCase();
      servingDesc = `${servingDesc} ${itemName}`;
    }
    
    return (
      <div className="flex items-start sm:items-center justify-between py-2.5 px-3 gap-3 hover:bg-blue-50/50 rounded-lg transition-colors border-b border-gray-100 last:border-0">
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-1 flex-wrap">
            <span className="font-medium text-gray-900 text-sm">{foodItem.name}</span>
            {servingDesc && (
              <span className="text-xs text-gray-600 whitespace-nowrap">
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
                setSearchError(null);
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        
        {/* Search Results Count */}
        {searchResults.length > 0 && !isSearching && !searchError && searchQuery !== foodItem.name && (
          <div className="mt-1.5 px-1">
            <div className="inline-flex items-center gap-1.5 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
              <Search className="w-3 h-3" />
              <span>{searchResults.length} alternative{searchResults.length > 1 ? 's' : ''} found</span>
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
      {searchResults.length > 0 && !isSearching && searchQuery !== foodItem.name && (
        <div className="max-h-48 overflow-y-auto border border-gray-300 rounded-lg bg-white shadow-sm">
          {searchResults.map((food, idx) => (
            <button
              key={idx}
              onClick={() => handleFoodSelect(food)}
              className="w-full text-left px-3 py-2.5 hover:bg-blue-50 active:bg-blue-100 transition-all duration-150 border-b last:border-b-0 text-sm group"
            >
              <div className="font-medium text-gray-900 mb-1 group-hover:text-blue-700 transition-colors">{food.name}</div>
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <span className="bg-gray-100 group-hover:bg-blue-100 px-2 py-0.5 rounded transition-colors">{food.category}</span>
                <span className="text-red-600 flex items-center gap-1 font-medium">
                  <Flame className="w-3 h-3" />
                  {food.defaultServing.nutrition.calories}
                </span>
                <span className="text-gray-500">/ {food.defaultServing.description}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Serving Size and Grams Controls - Always visible in edit mode */}
      <div className="space-y-2.5">
        {/* Serving Size Dropdown */}
        {selectedFood && servingOptions.length > 0 && (
          <div className="relative">
            <label className="block text-xs font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
              <Utensils className="w-3.5 h-3.5 text-gray-500" />
              <span>Serving Size</span>
            </label>
            
            {/* Dropdown Toggle Button */}
            <button
              type="button"
              onClick={() => setIsServingDropdownOpen(!isServingDropdownOpen)}
              className="w-full px-3 py-2 rounded-lg border-2 border-gray-300 bg-white text-left transition-all hover:border-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 flex items-center justify-between"
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 text-sm truncate">
                  {currentServing?.description || 'Select serving size'}
                </div>
              </div>
              <svg 
                className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ml-2 ${
                  isServingDropdownOpen ? 'rotate-180' : ''
                }`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown Options - Overlapping */}
            {isServingDropdownOpen && (
              <div className="absolute z-50 w-full mt-1 space-y-1 max-h-64 overflow-y-auto bg-white rounded-lg border-2 border-gray-300 shadow-lg p-2">
                {servingOptions.map((option, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setCurrentServing(option);
                      setCurrentServingIndex(idx);
                      setCustomGrams(option.grams.toString());
                      setIsServingDropdownOpen(false);
                    }}
                    className={`w-full px-3 py-2 rounded-lg transition-all text-left text-sm ${
                      currentServingIndex === idx
                        ? 'bg-blue-50 text-blue-900'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{option.description}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{option.nutrition.calories} cal</div>
                      </div>
                      {currentServingIndex === idx && (
                        <svg className="w-5 h-5 text-blue-600 flex-shrink-0 ml-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Custom Grams Input - Always visible */}        {/* Custom Grams Input - Always visible */}
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
