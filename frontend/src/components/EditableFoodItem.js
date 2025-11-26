// src/components/EditableFoodItem.js
import React, { useState, useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { geminiService } from '../services/geminiService';
import { Search, Edit2, Save, X, Scale, Utensils, Flame, Beef, Wheat, Droplet, Leaf } from 'lucide-react';

/**
 * Editable food item component for nutrition breakdown
 * Allows users to search and replace food items with accurate serving sizes
 */
const EditableFoodItem = forwardRef(({ foodItem, onUpdate, index, onEditingChange, disabled, onSave, onCancel, hideButtons }, ref) => {
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

  // Expose save and cancel methods to parent via ref
  useImperativeHandle(ref, () => ({
    save: handleSave,
    cancel: handleCancel,
    isEditing
  }));

  // Notify parent when editing state changes
  useEffect(() => {
    if (onEditingChange) {
      onEditingChange(index, isEditing);
    }
  }, [isEditing, index, onEditingChange]);

  // Initialize with current food item data
  // This preserves the original weight when entering edit mode
  useEffect(() => {
    if (foodItem) {
      const grams = foodItem.serving?.grams || foodItem.grams || '';
      setCustomGrams(grams);
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

  // Convert text numbers to digits
  const textToNumber = (text) => {
    const numberWords = {
      'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
      'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
      'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
      'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19, 'twenty': 20,
      'half': 0.5, 'quarter': 0.25
    };
    
    const lowerText = text.toLowerCase();
    
    // Check for exact word match
    for (const [word, num] of Object.entries(numberWords)) {
      if (lowerText.includes(word)) {
        return num;
      }
    }
    
    return null;
  };

  // Generate dynamic serving options based on detected quantity
  const generateServingOptions = (baseServing, per100g, itemName, portionDesc) => {
    const options = [];
    
    // Extract quantity from portion description - handles fractions, whole numbers, text numbers, and numbers-only
    // Examples: "2 idlis", "two parottas", "1/2 cup", "1 1/2 bowls", "3 chapatis", "3"
    let detectedQuantity = 1;
    let itemUnit = itemName.toLowerCase();
    let useFractionFormat = false; // Track if original was in fraction format
    
    // Helper function to convert decimal to fraction string
    const decimalToFraction = (decimal) => {
      if (decimal % 1 === 0) {
        // Whole number
        return decimal.toString();
      }
      
      const whole = Math.floor(decimal);
      const fractionalPart = decimal - whole;
      
      // Common fractions
      const fractions = {
        0.25: '1/4',
        0.5: '1/2',
        0.75: '3/4',
        0.333: '1/3',
        0.667: '2/3'
      };
      
      // Find closest fraction match
      for (const [dec, frac] of Object.entries(fractions)) {
        if (Math.abs(fractionalPart - parseFloat(dec)) < 0.01) {
          return whole > 0 ? `${whole} ${frac}` : frac;
        }
      }
      
      // If no common fraction match, use decimal
      return decimal % 1 === 0 ? decimal.toString() : decimal.toFixed(1);
    };
    
    // First, try to convert text numbers to digits (e.g., "two parottas" -> "2 parottas")
    let normalizedDesc = portionDesc;
    const textNum = textToNumber(portionDesc);
    if (textNum !== null) {
      // Replace text number with digit
      const textWords = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
                        'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty',
                        'half', 'quarter'];
      for (const word of textWords) {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        if (regex.test(portionDesc)) {
          const numberWords = {
            'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
            'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
            'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
            'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19, 'twenty': 20,
            'half': 0.5, 'quarter': 0.25
          };
          normalizedDesc = portionDesc.replace(regex, numberWords[word.toLowerCase()]);
          break;
        }
      }
    }
    
    // Try to match fraction pattern (e.g., "1/2 cup", "1 1/2 bowls", "0.5 cup")
    const fractionMatch = normalizedDesc.match(/(\d+)?\s*(\d+)\/(\d+)\s*([a-zA-Z]+)/);
    if (fractionMatch) {
      useFractionFormat = true; // Original was in fraction format
      const whole = fractionMatch[1] ? parseInt(fractionMatch[1]) : 0;
      const numerator = parseInt(fractionMatch[2]);
      const denominator = parseInt(fractionMatch[3]);
      detectedQuantity = whole + (numerator / denominator);
      itemUnit = fractionMatch[4];
    } else {
      // Try to match decimal number (e.g., "0.5 cup")
      const decimalMatch = normalizedDesc.match(/(\d+\.?\d*)\s*([a-zA-Z]+)/);
      if (decimalMatch) {
        detectedQuantity = parseFloat(decimalMatch[1]);
        itemUnit = decimalMatch[2];
      } else {
        // Try to match whole number with unit (e.g., "2 idlis", "3 chapatis")
        const wholeMatch = normalizedDesc.match(/(\d+)\s*([a-zA-Z]+)/);
        if (wholeMatch) {
          detectedQuantity = parseInt(wholeMatch[1]);
          itemUnit = wholeMatch[2];
        } else {
          // Try to match number-only (e.g., "3")
          const numberOnlyMatch = normalizedDesc.match(/^\d+\.?\d*$/);
          if (numberOnlyMatch) {
            detectedQuantity = parseFloat(normalizedDesc);
            // itemUnit already set to itemName.toLowerCase()
          }
        }
      }
    }
    
    // Generate serving options dynamically following the pattern:
    // 0.25 (1/4) → 0.25, 0.5, 0.75, 1, 1.5
    // 0.5 (1/2) → 0.25, 0.5, 1, 1.5, 2
    // 1 → 0.5, 1, 1.5, 2, 3
    // 2 → 1, 1.5, 2, 2.5, 3, 4
    // 3 → 1, 2, 2.5, 3, 3.5, 4, 5
    // Pattern: Always use 0.5 and 1 increments only, minimum 0.25
    
    const servingSizes = [];
    
    // Generate options below original
    if (detectedQuantity <= 0.5) {
      // For 0.25 and 0.5: add smaller fractions
      if (detectedQuantity > 0.25) {
        servingSizes.push(0.25);
      }
      if (detectedQuantity === 0.5) {
        // Already have 0.25, don't duplicate
      }
    } else if (detectedQuantity === 0.75) {
      servingSizes.push(0.25, 0.5);
    } else if (detectedQuantity === 1) {
      servingSizes.push(0.5);
    } else if (detectedQuantity === 1.5) {
      servingSizes.push(0.5, 1);
    } else if (detectedQuantity >= 2) {
      // For 2 and above: add options below in 0.5 decrements
      // Try to get 2 options below, but not go below 0.5 for values < 2, or 1 for values >= 2
      const minValue = detectedQuantity >= 2 ? 1 : 0.5;
      
      // First option below (larger decrement)
      let firstBelow;
      if (detectedQuantity >= 3) {
        // For 3+: go down by 1 or more
        firstBelow = Math.max(minValue, detectedQuantity - Math.floor(detectedQuantity / 2));
      } else {
        // For 2-2.5: go down by 0.5 or 1
        firstBelow = Math.max(minValue, detectedQuantity - 1);
      }
      
      // Second option below (smaller decrement)
      const secondBelow = detectedQuantity - 0.5;
      
      // Add first below if valid and different from second
      if (firstBelow >= minValue && Math.abs(firstBelow - secondBelow) > 0.1) {
        servingSizes.push(firstBelow);
      }
      
      // Add second below if valid
      if (secondBelow >= minValue) {
        servingSizes.push(secondBelow);
      }
    }
    
    // Add original
    servingSizes.push(detectedQuantity);
    
    // Generate options above original
    if (detectedQuantity < 0.5) {
      // For 0.25: add 0.5, 0.75, 1, 1.5
      servingSizes.push(0.5, 0.75, 1, 1.5);
    } else if (detectedQuantity === 0.5) {
      // For 0.5: add 1, 1.5, 2
      servingSizes.push(1, 1.5, 2);
    } else if (detectedQuantity === 0.75) {
      // For 0.75: add 1, 1.5, 2
      servingSizes.push(1, 1.5, 2);
    } else {
      // For 1 and above: add +0.5, +1, and larger jumps
      servingSizes.push(detectedQuantity + 0.5);
      servingSizes.push(detectedQuantity + 1);
      
      // Add bigger jumps for variety
      if (detectedQuantity >= 2) {
        servingSizes.push(detectedQuantity + 1.5);
        servingSizes.push(detectedQuantity + 2.5);
      } else {
        // For 1-1.5: add 3 as a bigger option
        servingSizes.push(detectedQuantity + 1.5);
      }
    }
    
    // Remove duplicates and sort
    const uniqueSizes = [...new Set(servingSizes)].sort((a, b) => a - b);
    
    // Generate options from unique sizes
    uniqueSizes.forEach((qty) => {
      const multiplier = qty / detectedQuantity;
      const gramsForQty = Math.round(baseServing.grams * multiplier);
      const nutritionMultiplier = gramsForQty / 100;
      
      // Format display based on original format
      let qtyDisplay;
      if (useFractionFormat) {
        // Use fraction format (e.g., "1/2", "3/4", "1 1/2")
        qtyDisplay = decimalToFraction(qty);
      } else {
        // Use decimal format (e.g., "0.5", "1", "1.5")
        qtyDisplay = qty % 1 === 0 ? qty.toString() : qty.toFixed(1);
      }
      
      const isOriginal = Math.abs(qty - detectedQuantity) < 0.01;
      
      options.push({
        description: isOriginal 
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
        isOriginal: isOriginal
      });
    });
    
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
    
    // IMPORTANT: Preserve the original weight from the food item being edited
    // Do NOT change customGrams - keep the existing weight
    const existingGrams = parseFloat(customGrams);
    
    // Find the closest serving option to the existing weight (for display purposes)
    if (!isNaN(existingGrams) && existingGrams > 0) {
      const closestIndex = options.reduce((closestIdx, opt, idx) => {
        const currentDiff = Math.abs(options[closestIdx].grams - existingGrams);
        const newDiff = Math.abs(opt.grams - existingGrams);
        return newDiff < currentDiff ? idx : closestIdx;
      }, 0);
      
      setCurrentServing(options[closestIndex]);
      setCurrentServingIndex(closestIndex);
      // Keep the existing customGrams value - DO NOT override it
    } else {
      // Fallback to default serving only if no valid existing weight
      setCurrentServing(options[0]);
      setCurrentServingIndex(0);
      setCustomGrams(options[0].grams.toString());
    }
  };

  // Handle serving size dropdown change
  const handleServingChange = (e) => {
    const selectedIndex = parseInt(e.target.value);
    const selected = servingOptions[selectedIndex];
    
    if (selected) {
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
        // Check if grams exactly match any serving option (within 1g tolerance)
        const exactMatchIndex = servingOptions.findIndex(
          opt => Math.abs(opt.grams - gramsValue) < 1
        );
        
        if (exactMatchIndex !== -1) {
          // Exact match found - update serving display to match
          setCurrentServing(servingOptions[exactMatchIndex]);
          setCurrentServingIndex(exactMatchIndex);
        } else {
          // Find closest serving option for display only
          // IMPORTANT: Never override customGrams - let user type any value
          const closestIndex = servingOptions.reduce((closestIdx, opt, idx) => {
            const currentDiff = Math.abs(servingOptions[closestIdx].grams - gramsValue);
            const newDiff = Math.abs(opt.grams - gramsValue);
            return newDiff < currentDiff ? idx : closestIdx;
          }, 0);
          
          setCurrentServing(servingOptions[closestIndex]);
          setCurrentServingIndex(closestIndex);
          // customGrams is already set above - don't override it
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
    
    // Call parent update handler
    onUpdate(index, updatedFood);
    
    // Exit edit mode
    setIsEditing(false);
    setSearchQuery('');
    setSearchResults([]);
    setSelectedFood(null);
    setServingOptions([]);
    
    // Notify parent if callback provided
    if (onSave) {
      onSave(index);
    }
  };

  // Cancel editing
  const handleCancel = () => {
    setIsEditing(false);
    setSearchQuery('');
    setSearchResults([]);
    setSearchError(null);
    setSelectedFood(null);
    setServingOptions([]);
    setCustomGrams(foodItem.serving?.grams || foodItem.grams || '');
    
    // Notify parent if callback provided
    if (onCancel) {
      onCancel(index);
    }
  };

  // Enter edit mode
  const handleEdit = () => {
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
      <div className="flex items-start sm:items-center justify-between py-2.5 px-3 gap-4 hover:bg-gray-50 rounded-lg transition-colors border-b border-gray-100 last:border-0">
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-1 flex-wrap">
            <span className="font-medium text-gray-900 text-base">{foodItem.name}</span>
            {servingDesc && (
              <span className="text-sm text-gray-600">{servingDesc}</span>
            )}
          </div>
          <div className="text-xs text-gray-600">
            <span className="font-bold text-orange-600 text-sm">{foodItem.nutrition?.calories || foodItem.calories || 0}</span> <span className="text-orange-600">kcal</span> · Protein {foodItem.nutrition?.protein || foodItem.protein || 0}g · Carbs {foodItem.nutrition?.carbs || foodItem.carbs || 0}g · Fiber {foodItem.nutrition?.fiber || foodItem.fiber || 0}g · Fat {foodItem.nutrition?.fat || foodItem.fat || 0}g
          </div>
        </div>
        <button
          onClick={handleEdit}
          disabled={disabled}
          className={`shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 border ${
            disabled 
              ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
              : 'text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200'
          }`}
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
            onContextMenu={(e) => e.preventDefault()}
            onFocus={(e) => {
              // Scroll input into view when keyboard appears on mobile
              setTimeout(() => {
                e.target.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }, 300);
            }}
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
                        <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
                          <span>{option.grams}g</span>
                          <span>•</span>
                          <span>{option.nutrition.calories} cal</span>
                        </div>
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
              onContextMenu={(e) => e.preventDefault()}
              placeholder="Enter grams"
              className="w-full px-3 py-2 pr-8 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">g</span>
          </div>
        </div>

        {/* Nutrition Preview - Glassmorphism Pills */}
        {customGrams && selectedFood && selectedFood.per100g && (
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
              <Utensils className="w-3.5 h-3.5 text-gray-500" />
              <span>Preview ({customGrams}g)</span>
            </label>
            {(() => {
              const nutrition = calculateNutrition(selectedFood.per100g, parseFloat(customGrams));
              return nutrition ? (
                <div className="flex flex-wrap justify-start gap-1.5 sm:gap-2">
                  {/* Calories Pill - Glassmorphism */}
                  <div className="flex items-center justify-center gap-1.5 sm:gap-2 min-h-[40px] sm:min-h-[44px] bg-red-50/80 backdrop-blur-sm border border-red-200/50 rounded-full px-2.5 sm:px-3 py-2 sm:py-2.5 flex-shrink-0">
                    <Flame className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-600 flex-shrink-0" />
                    <span className="text-xs sm:text-sm font-bold text-red-700 whitespace-nowrap">{nutrition.calories}</span>
                  </div>
                  
                  {/* Protein Pill - Glassmorphism */}
                  <div className="flex items-center justify-center gap-1.5 sm:gap-2 min-h-[40px] sm:min-h-[44px] bg-blue-50/80 backdrop-blur-sm border border-blue-200/50 rounded-full px-2.5 sm:px-3 py-2 sm:py-2.5 flex-shrink-0">
                    <Beef className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 flex-shrink-0" />
                    <span className="text-xs sm:text-sm font-bold text-blue-700 whitespace-nowrap">{nutrition.protein}g</span>
                  </div>
                  
                  {/* Carbs Pill - Glassmorphism */}
                  <div className="flex items-center justify-center gap-1.5 sm:gap-2 min-h-[40px] sm:min-h-[44px] bg-yellow-50/80 backdrop-blur-sm border border-yellow-200/50 rounded-full px-2.5 sm:px-3 py-2 sm:py-2.5 flex-shrink-0">
                    <Wheat className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-yellow-700 flex-shrink-0" />
                    <span className="text-xs sm:text-sm font-bold text-yellow-800 whitespace-nowrap">{nutrition.carbs}g</span>
                  </div>
                  
                  {/* Fat Pill - Glassmorphism */}
                  <div className="flex items-center justify-center gap-1.5 sm:gap-2 min-h-[40px] sm:min-h-[44px] bg-purple-50/80 backdrop-blur-sm border border-purple-200/50 rounded-full px-2.5 sm:px-3 py-2 sm:py-2.5 flex-shrink-0">
                    <Droplet className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-600 flex-shrink-0" />
                    <span className="text-xs sm:text-sm font-bold text-purple-700 whitespace-nowrap">{nutrition.fat}g</span>
                  </div>
                  
                  {/* Fiber Pill - Glassmorphism */}
                  <div className="flex items-center justify-center gap-1.5 sm:gap-2 min-h-[40px] sm:min-h-[44px] bg-green-50/80 backdrop-blur-sm border border-green-200/50 rounded-full px-2.5 sm:px-3 py-2 sm:py-2.5 flex-shrink-0">
                    <Leaf className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-600 flex-shrink-0" />
                    <span className="text-xs sm:text-sm font-bold text-green-700 whitespace-nowrap">{nutrition.fiber}g</span>
                  </div>
                </div>
              ) : null;
            })()}
          </div>
        )}
      </div>

      {/* Action Buttons - only show if not hidden by parent */}
      {!hideButtons && (
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
      )}
    </div>
  );
});

EditableFoodItem.displayName = 'EditableFoodItem';

export default EditableFoodItem;
