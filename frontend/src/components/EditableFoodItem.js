// src/components/EditableFoodItem.js
import React, { useState, useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { geminiService } from '../services/geminiService';
import { saveFoodCorrection } from '../services/foodCorrectionService';
import { getUserContext } from '../services/userContextService';
import { Search, Edit2, Save, X, Scale, Utensils, Flame, Beef, Wheat, Droplet, Leaf } from 'lucide-react';

/**
 * Editable food item component for nutrition breakdown
 * Allows users to search and replace food items with accurate serving sizes
 */
const EditableFoodItem = forwardRef(({ foodItem, onUpdate, index, onEditingChange, disabled, onSave, onCancel, hideButtons, user }, ref) => {
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
  
  // Cache userId to avoid repeated API calls
  const userIdRef = useRef(user?.id || null);
  
  // Auto-save timer ref (Phase 1: Debounced Auto-Save)
  const autoSaveTimeoutRef = useRef(null);
  
  // Track if user has made changes (Phase 1: Prevent auto-save on edit mode entry)
  const hasUserChangesRef = useRef(false);
  
  // Track if Phase 2 instant save is in progress (prevents Phase 1 from interfering)
  const isInstantSavingRef = useRef(false);
  
  // Phase 3: Sync status indicator
  const [syncStatus, setSyncStatus] = useState('idle'); // idle|syncing|saved|error|retrying
  const syncStatusTimeoutRef = useRef(null);
  
  // Phase 5: Retry logic
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;
  const retryTimeoutRef = useRef(null);
  
  // Phase 7: AbortController to cancel pending saves
  const abortControllerRef = useRef(null);

  // Expose save and cancel methods to parent via ref
  useImperativeHandle(ref, () => ({
    save: handleDone,  // Changed from handleSave to handleDone
    cancel: handleCancel,
    isEditing
  }));

  // Notify parent when editing state changes or sync status changes
  useEffect(() => {
    if (onEditingChange) {
      // Pass editing state and whether actively saving/retrying (blocking close)
      const isBlocking = syncStatus === 'retrying';
      onEditingChange(index, isEditing, isBlocking);
    }
  }, [isEditing, syncStatus, index, onEditingChange]);

  // Initialize with current food item data
  // This preserves the original weight when entering edit mode
  // Skip updates when in edit mode to prevent auto-save from resetting the UI
  useEffect(() => {
    if (foodItem && !isEditing) {
      const grams = foodItem.serving?.grams || foodItem.grams || '';
      setCustomGrams(grams);
    }
  }, [foodItem, isEditing]);

  // Phase 1: Debounced Auto-Save (Weight Input Only)
  // Automatically save changes after 1 second of inactivity when typing weight
  useEffect(() => {
    // Skip if Phase 2 instant save is in progress
    if (isInstantSavingRef.current) {
      return;
    }
    
    // Only auto-save when in edit mode and have valid data
    if (!isEditing || !customGrams) {
      return;
    }

    // Don't auto-save if user hasn't made any changes yet
    if (!hasUserChangesRef.current) {
      return;
    }

    // Clear any existing auto-save timer
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    // Validate data before setting timer
    const grams = parseFloat(customGrams);
    if (isNaN(grams) || grams <= 0) {
      return;
    }

    // Set new timer for auto-save after 1 second of inactivity
    autoSaveTimeoutRef.current = setTimeout(() => {
      handleAutoSave();
      hasUserChangesRef.current = false; // Reset after save
    }, 1000);

    // Cleanup: Clear timer when dependencies change or component unmounts
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [customGrams, isEditing]);

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
      // Phase 1: Cleanup auto-save timer on unmount
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      // Phase 5: Cleanup retry timeout on unmount
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
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
    
    const result = {
      calories: Math.round(per100g.calories * multiplier),
      protein: Math.ceil(per100g.protein * multiplier),
      carbs: Math.ceil(per100g.carbs * multiplier),
      fat: Math.ceil(per100g.fat * multiplier),
      fiber: Math.ceil((per100g.fiber || 0) * multiplier)
    };
    
    return result;
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
  const handleFoodSelect = async (food) => {
    console.log('[CORRECTION DEBUG] handleFoodSelect triggered');
    console.log('[CORRECTION DEBUG] Original food:', originalFoodRef.current?.name);
    console.log('[CORRECTION DEBUG] New food selected:', food.name);
    
    setSelectedFood(food);
    setSearchQuery(food.name);
    setSearchResults([]);
    
    // Track food correction if name changed
    try {
      const originalName = originalFoodRef.current?.name;
      const newName = food.name;
      
      // Check if user changed the food name
      if (originalName && newName && originalName.trim().toLowerCase() !== newName.trim().toLowerCase()) {
        console.log('[CORRECTION DEBUG] ✅ Name changed - saving correction');
        
        // Get userId (use cache first, then fetch if needed)
        let userId = userIdRef.current || user?.id;
        if (!userId && user) {
          console.log('[CORRECTION DEBUG] Fetching userId from database...');
          const { getUserId } = await import('../services/getUserId');
          userId = await getUserId(user);
          // Cache it for future use
          if (userId) {
            userIdRef.current = userId;
          }
        }
        console.log('[CORRECTION DEBUG] User ID:', userId);
        
        if (userId) {
          console.log('[CORRECTION DEBUG] Calling saveFoodCorrection API...');
          // Save correction asynchronously (don't block UI)
          saveFoodCorrection(userId, originalName, newName)
            .then(response => {
              console.log('[CORRECTION DEBUG] ✅ API Response:', response);
              if (response.success) {
                console.log('✅ Food correction saved:', response.message);
                
                // Refresh user context to update AI personalization
                console.log('🔄 [Food Correction] Refreshing user context...');
                getUserContext(userId)
                  .then(() => console.log('✅ [Food Correction] User context refreshed'))
                  .catch(error => console.error('❌ [Food Correction] Failed to refresh context:', error));
              }
            })
            .catch(error => {
              console.error('[CORRECTION DEBUG] ❌ API Error:', error);
            });
        } else {
          console.log('[CORRECTION DEBUG] ❌ No userId found');
        }
      } else {
        console.log('[CORRECTION DEBUG] ❌ Name not changed');
      }
    } catch (error) {
      console.error('[CORRECTION DEBUG] ❌ Exception:', error);
    }
    
    // Generate serving options locally using our consistent logic
    // IMPORTANT: Preserve the user's existing unit if they already have a value entered
    const existingGrams = parseFloat(customGrams);
    const hasExistingWeight = !isNaN(existingGrams) && existingGrams > 0;
    
    // Extract the original unit from the foodItem being edited
    let existingUnit = null;
    if (hasExistingWeight && foodItem) {
      // Try to extract unit from original food item's serving description
      const originalDesc = foodItem.serving?.description || foodItem.portionDescription || '';
      const unitMatch = originalDesc.match(/([a-zA-Z]+)\s*$/);
      existingUnit = unitMatch ? unitMatch[1] : null;
      console.log(`🔍 Original unit from foodItem: "${existingUnit}" (from: "${originalDesc}")`);
    }
    
    // Determine which serving description to use as base
    let baseServingDescription;
    let baseServingGrams;
    
    if (hasExistingWeight && existingUnit) {
      // User already has a weight with a unit - preserve their unit
      // Use existing weight with preserved unit
      const quantity = existingGrams / food.defaultServing.grams;
      baseServingDescription = `${quantity.toFixed(quantity % 1 === 0 ? 0 : 1)} ${existingUnit}`;
      baseServingGrams = existingGrams;
      console.log(`✅ Preserving user's existing unit: ${existingUnit} with ${existingGrams}ml as "${baseServingDescription}"`);
    } else {
      // No existing unit - use API's default serving
      baseServingDescription = food.defaultServing.description;
      baseServingGrams = food.defaultServing.grams;
    }
    
    // Use the determined base serving for generating options
    const baseServingForOptions = {
      grams: baseServingGrams,
      nutrition: hasExistingWeight && food.per100g 
        ? {
            calories: Math.round(food.per100g.calories * baseServingGrams / 100),
            protein: Math.ceil(food.per100g.protein * baseServingGrams / 100),
            carbs: Math.ceil(food.per100g.carbs * baseServingGrams / 100),
            fat: Math.ceil(food.per100g.fat * baseServingGrams / 100),
            fiber: Math.ceil((food.per100g.fiber || 0) * baseServingGrams / 100)
          }
        : food.defaultServing.nutrition
    };
    
    let options = [];
    
    // Check if per100g data is available to generate dynamic options
    if (food.per100g && food.per100g.calories > 0) {
      // Generate dynamic serving options using our proven algorithm
      options = generateServingOptions(
        baseServingForOptions,
        food.per100g,
        food.name,
        baseServingDescription
      );
      console.log(`✅ Generated ${options.length} consistent serving options locally`);
    } else {
      // Fallback: just use default serving if no per100g data
      options = [
        {
          description: baseServingDescription,
          grams: baseServingGrams,
          nutrition: baseServingForOptions.nutrition,
          isDefault: true
        }
      ];
    }
    
    setServingOptions(options);
    
    // Find the closest serving option to the existing weight (for display purposes)
    if (hasExistingWeight) {
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
    
    // Phase 2: Instant save when food is selected (no delay)
    // Set flag to prevent Phase 1 from interfering
    isInstantSavingRef.current = true;
    
    // Cancel any pending auto-save timer from Phase 1
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
      autoSaveTimeoutRef.current = null;
    }
    
    // Save immediately with the newly selected food
    // Use setTimeout to ensure React has queued the state updates
    setTimeout(() => {
      // Determine grams to use
      const gramsToUse = !isNaN(existingGrams) && existingGrams > 0 
        ? existingGrams.toString() 
        : options[0].grams.toString();
      
      handleAutoSave(food, gramsToUse);
      
      // Reset flag after save completes
      setTimeout(() => {
        isInstantSavingRef.current = false;
      }, 200);
    }, 150);
  };

  // Handle custom grams input
  const handleGramsChange = (e) => {
    const value = e.target.value;
    
    // Allow only numbers and decimal point
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setCustomGrams(value);
      
      // Phase 1: Mark that user made a change
      hasUserChangesRef.current = true;
      
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

  // Auto-save changes (keeps edit mode open) with retry logic
  const handleAutoSave = async (overrideFood = null, overrideGrams = null, overrideServingDesc = null, currentRetry = 0) => {
    const gramsToUse = overrideGrams || customGrams;
    
    if (!gramsToUse) {
      return;
    }
    
    const grams = parseFloat(gramsToUse);
    if (isNaN(grams) || grams <= 0) {
      return;
    }
    
    // Use override food (for instant saves) or selected food or current food item
    const foodToSave = overrideFood || selectedFood || {
      name: foodItem.name,
      category: foodItem.category,
      per100g: foodItem.per100g
    };
    
    // Validate per100g exists
    if (!foodToSave.per100g) {
      console.error('❌ Cannot save: per100g data missing', foodToSave);
      setSyncStatus('error');
      return;
    }
    
    // Calculate final nutrition
    const nutrition = calculateNutrition(foodToSave.per100g, grams);
    
    const unit = foodToSave.unit || (foodToSave.isLiquid ? 'ml' : 'g');
    const updatedFood = {
      name: foodToSave.name,
      category: foodToSave.category,
      serving: {
        description: overrideServingDesc || currentServing?.description || `${grams}${unit}`,
        grams: grams,
        unit: unit,
        isLiquid: foodToSave.isLiquid || false
      },
      grams: grams,
      unit: unit,
      isLiquid: foodToSave.isLiquid || false,
      nutrition: nutrition,
      per100g: foodToSave.per100g
    };
    
    try {
      // Phase 7: Cancel any pending save request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();
      
      // Phase 5: Set saving status (prevents closing during save)
      setSyncStatus(currentRetry > 0 ? 'retrying' : 'saving');
      
      // Phase 5: Add timeout wrapper for API call (10 seconds max)
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 10000)
      );
      
      await Promise.race([
        onUpdate(index, updatedFood),
        timeoutPromise
      ]);
      
      // Success - reset retry count and show saved status
      setRetryCount(0);
      setSyncStatus('saved');
      
      if (syncStatusTimeoutRef.current) {
        clearTimeout(syncStatusTimeoutRef.current);
      }
      
      syncStatusTimeoutRef.current = setTimeout(() => {
        setSyncStatus('idle');
      }, 1500);
      
    } catch (error) {
      console.error(`❌ Auto-save failed (attempt ${currentRetry + 1}/${maxRetries}):`, error);
      
      // Phase 5: Auto-retry with exponential backoff
      if (currentRetry < maxRetries - 1) {
        const retryDelay = Math.pow(2, currentRetry) * 1000; // 1s, 2s, 4s
        setRetryCount(currentRetry + 1);
        setSyncStatus('retrying');
        
        // Clear any existing retry timeout
        if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current);
        }
        
        retryTimeoutRef.current = setTimeout(() => {
          handleAutoSave(overrideFood, overrideGrams, overrideServingDesc, currentRetry + 1);
        }, retryDelay);
      } else {
        // Max retries reached - show persistent error
        setRetryCount(0);
        setSyncStatus('error');
        // Don't auto-hide error - let user see it and manually retry
      }
    }
  };
  
  // Phase 5: Manual retry function
  const handleManualRetry = () => {
    setRetryCount(0);
    setSyncStatus('retrying'); // Set to retrying state to block modal close
    handleAutoSave(); // This will handle the save and update status accordingly
  };

  // Close edit mode - data already auto-saved
  const handleDone = async () => {
    // Clear any pending auto-save timers
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    if (syncStatusTimeoutRef.current) {
      clearTimeout(syncStatusTimeoutRef.current);
    }
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
    }
    
    // Phase 7: Cancel any pending API request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    // Reset change tracking
    hasUserChangesRef.current = false;
    isInstantSavingRef.current = false;
    setRetryCount(0);
    
    // Exit edit mode
    setIsEditing(false);
    setSearchQuery('');
    setSearchResults([]);
    setSearchError(null);
    setSelectedFood(null);
    setServingOptions([]);
    setSyncStatus('idle');
    
    // Notify parent if callback provided
    if (onSave) {
      onSave(index);
    }
  };

  // Cancel editing
  const handleCancel = () => {
    // Phase 1: Clear auto-save timer when canceling
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    
    // Phase 5: Clear retry timeout
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
    }
    
    // Phase 1: Reset change tracking
    hasUserChangesRef.current = false;
    setRetryCount(0);
    
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
    
    // Phase 1: Reset change tracking when entering edit mode
    hasUserChangesRef.current = false;
    
    // Debug: Log foodItem to see what data we have
    console.log('🔍 [EditableFoodItem] handleEdit - foodItem:', {
      name: foodItem.name,
      unit: foodItem.unit,
      isLiquid: foodItem.isLiquid,
      servingUnit: foodItem.serving?.unit,
      servingIsLiquid: foodItem.serving?.isLiquid,
      fullItem: foodItem
    });
    
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
      calories: currentCalories * 100 / currentGrams, // Keep precise value, don't round
      protein: currentProtein * 100 / currentGrams,
      carbs: currentCarbs * 100 / currentGrams,
      fat: currentFat * 100 / currentGrams,
      fiber: currentFiber * 100 / currentGrams
    };
    
    // Get unit from foodItem
    const itemUnit = foodItem.unit || foodItem.serving?.unit || (foodItem.isLiquid || foodItem.serving?.isLiquid ? 'ml' : 'g');
    const portionDesc = foodItem.serving?.description || foodItem.portionDescription || `${currentGrams}${itemUnit}`;
    
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
      unit: foodItem.unit || foodItem.serving?.unit || 'g',
      isLiquid: foodItem.isLiquid || foodItem.serving?.isLiquid || false,
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
    const unit = foodItem.unit || foodItem.serving?.unit || 'g';
    const isLiquid = foodItem.isLiquid || foodItem.serving?.isLiquid || false;
    
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
            {displayGrams && (
              <span className="text-xs text-gray-500">({displayGrams}{unit})</span>
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
    <div className={`
      bg-blue-50/50 rounded-lg p-3 space-y-3 border-2 transition-all duration-300
      ${syncStatus === 'saved' ? 'border-blue-200 glow-green-pulse' : 'border-blue-200'}
      ${syncStatus === 'error' ? 'border-red-400' : ''}
      ${syncStatus === 'retrying' ? 'border-orange-400' : ''}
    `}>
      {/* Search Input with Sync Status */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">
          <div className="flex items-center justify-between gap-2 w-full">
            <div className="flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-gray-500" />
              <span>Search Food</span>
            </div>
            
            {/* Phase 3 & 5: Sync Status Indicator - Top Right */}
            {syncStatus !== 'idle' && (
              <div 
                className="flex items-center gap-1.5 text-xs font-medium whitespace-nowrap"
                role="status"
                aria-live="polite"
              >
                {syncStatus === 'retrying' && (
                  <>
                    <div className="w-3 h-3 border-2 border-orange-600 border-t-transparent rounded-full animate-spin flex-shrink-0" aria-hidden="true" />
                    <span className="text-orange-700">Retrying... ({retryCount}/{maxRetries})</span>
                    <span className="sr-only">Retrying save, attempt {retryCount} of {maxRetries}</span>
                  </>
                )}
                {syncStatus === 'saved' && (
                  <>
                    <svg className="w-3.5 h-3.5 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-green-700">Saved</span>
                    <span className="sr-only">Changes saved successfully</span>
                  </>
                )}
                {syncStatus === 'error' && (
                  <>
                    <svg className="w-4 h-4 text-red-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span className="text-red-700 font-medium">Save Failed</span>
                    <span className="sr-only">Error saving changes. Use the retry button to try again.</span>
                    <button
                      onClick={handleManualRetry}
                      aria-label="Retry saving changes"
                      className="ml-2 px-2.5 py-0.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded transition-colors flex items-center gap-1"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Retry
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
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
                      // Phase 2: Set flag to prevent Phase 1 from interfering
                      isInstantSavingRef.current = true;
                      
                      setCurrentServing(option);
                      setCurrentServingIndex(idx);
                      setCustomGrams(option.grams.toString());
                      setIsServingDropdownOpen(false);
                      
                      // Phase 2: Instant save on dropdown change
                      // Cancel any pending auto-save timer from Phase 1
                      if (autoSaveTimeoutRef.current) {
                        clearTimeout(autoSaveTimeoutRef.current);
                        autoSaveTimeoutRef.current = null;
                      }
                      
                      // Save immediately with the selected serving's grams
                      setTimeout(() => {
                        handleAutoSave(null, option.grams.toString(), option.description);
                        // Reset flag after save completes
                        setTimeout(() => {
                          isInstantSavingRef.current = false;
                        }, 200);
                      }, 150);
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
                          <span>{option.grams}{selectedFood?.unit || (selectedFood?.isLiquid ? 'ml' : 'g')}</span>
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

        {/* Custom Grams/ML Input - Always visible */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
            <Scale className="w-3.5 h-3.5 text-gray-500" />
            <span>{selectedFood?.isLiquid ? 'Volume' : 'Weight'}</span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={customGrams}
              onChange={handleGramsChange}
              onContextMenu={(e) => e.preventDefault()}
              placeholder={selectedFood?.isLiquid ? 'Enter ml' : 'Enter grams'}
              className="w-full px-3 py-2 pr-10 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
              {selectedFood?.unit || (selectedFood?.isLiquid ? 'ml' : 'g')}
            </span>
          </div>
        </div>

        {/* Nutrition Preview - Glassmorphism Pills */}
        {customGrams && selectedFood && selectedFood.per100g && (
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
              <Utensils className="w-3.5 h-3.5 text-gray-500" />
              <span>Preview ({customGrams}{selectedFood?.unit || (selectedFood?.isLiquid ? 'ml' : 'g')})</span>
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
        <button
          onClick={handleDone}
          disabled={syncStatus === 'saving' || syncStatus === 'retrying'}
          aria-busy={syncStatus === 'saving' || syncStatus === 'retrying'}
          aria-live="polite"
          className={`w-full rounded-lg text-white text-sm font-medium px-4 py-2.5 shadow-sm hover:shadow-md transition-all ${
            syncStatus === 'saving' || syncStatus === 'retrying'
              ? 'bg-gray-400 cursor-not-allowed opacity-50'
              : 'bg-indigo-600 hover:bg-indigo-700'
          }`}
        >
          <div className="flex items-center justify-center gap-2 h-5">
            {(syncStatus === 'saving' || syncStatus === 'retrying') ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                <span className="inline-block">Saving...</span>
                <span className="sr-only">Saving changes, please wait</span>
              </>
            ) : (
              <>
                <X className="w-4 h-4" aria-hidden="true" />
                <span className="inline-block">Close Edit</span>
              </>
            )}
          </div>
        </button>
      )}
    </div>
  );
});

EditableFoodItem.displayName = 'EditableFoodItem';

export default EditableFoodItem;
