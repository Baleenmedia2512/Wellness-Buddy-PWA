// src/services/duplicateDetectionService.js

/**
 * Get the meal category based on current time
 */
const getMealCategory = (date = new Date()) => {
  const hour = date.getHours();
  if (hour >= 5 && hour < 10) return 'breakfast';
  if (hour >= 10 && hour < 12) return 'morning-snack';
  if (hour >= 12 && hour < 16) return 'lunch';
  if (hour >= 16 && hour < 18) return 'evening-snack';
  if (hour >= 18 && hour < 23) return 'dinner';
  return 'late-night';
};

/**
 * Get user-friendly meal category name
 */
const getMealCategoryName = (category) => {
  const names = {
    'breakfast': 'Breakfast (5 AM - 10 AM)',
    'morning-snack': 'Morning Snack (10 AM - 12 PM)',
    'lunch': 'Lunch (12 PM - 4 PM)',
    'evening-snack': 'Evening Snack (4 PM - 6 PM)',
    'dinner': 'Dinner (6 PM - 11 PM)',
    'late-night': 'Late Night (11 PM - 5 AM)'
  };
  return names[category] || category;
};

/**
 * Extract food names from analysis result
 * Edge cases handled: null/undefined values, empty strings, whitespace, duplicates
 */
const extractFoodNames = (analysisResult) => {
  const names = [];
  
  try {
    // Edge case: null or undefined analysis result
    if (!analysisResult || typeof analysisResult !== 'object') {
      console.warn('Invalid analysis result provided to extractFoodNames');
      return [];
    }
    
    // Helper to safely extract and normalize food name
    const addFoodName = (name) => {
      if (!name || typeof name !== 'string') return;
      const normalized = name.trim().toLowerCase();
      // Edge case: empty string after trim, or very short names (likely invalid)
      if (normalized.length < 2) return;
      // Edge case: avoid duplicates in the same result
      if (!names.includes(normalized)) {
        names.push(normalized);
      }
    };
    
    // Handle foods array format (background service)
    if (analysisResult?.foods && Array.isArray(analysisResult.foods)) {
      analysisResult.foods.forEach(food => {
        if (food && typeof food === 'object') {
          addFoodName(food.name);
        }
      });
    }
    
    // Handle detailedItems format (manual save)
    if (analysisResult?.detailedItems && Array.isArray(analysisResult.detailedItems)) {
      analysisResult.detailedItems.forEach(item => {
        if (item && typeof item === 'object') {
          addFoodName(item.name);
        }
      });
    }
    
    // Handle category format
    if (analysisResult?.category?.name) {
      addFoodName(analysisResult.category.name);
    }
    
    // Edge case: no food names found
    if (names.length === 0) {
      console.warn('No valid food names extracted from analysis result');
    }
  } catch (error) {
    console.error('Error extracting food names:', error);
    return []; // Return empty array on error
  }
  
  return names;
};

/**
 * Parse analysis data from database
 * Edge cases: malformed JSON, null values, empty data, various formats
 */
const parseAnalysisData = (analysisData) => {
  try {
    // Edge case: null or undefined data
    if (!analysisData) {
      return [];
    }
    
    // Edge case: empty string
    if (typeof analysisData === 'string' && analysisData.trim() === '') {
      return [];
    }
    
    let parsed;
    try {
      parsed = typeof analysisData === 'string' ? JSON.parse(analysisData) : analysisData;
    } catch (jsonError) {
      console.error('Invalid JSON in analysis data:', jsonError);
      return [];
    }
    
    // Edge case: parsed result is not an object
    if (!parsed || typeof parsed !== 'object') {
      return [];
    }
    
    const names = [];
    
    // Helper to safely add food name
    const addName = (name) => {
      if (!name || typeof name !== 'string') return;
      const normalized = name.trim().toLowerCase();
      if (normalized.length >= 2 && !names.includes(normalized)) {
        names.push(normalized);
      }
    };
    
    // Unified format: foods[] + total
    if (Array.isArray(parsed.foods) && parsed.foods.length > 0) {
      parsed.foods.forEach(food => {
        if (food && typeof food === 'object') {
          addName(food.name);
        }
      });
    }
    
    // Legacy manual: category + nutrition
    if (parsed.category && typeof parsed.category === 'object') {
      addName(parsed.category.name);
    }
    
    // Edge case: detailedItems format (fallback)
    if (Array.isArray(parsed.detailedItems) && parsed.detailedItems.length > 0) {
      parsed.detailedItems.forEach(item => {
        if (item && typeof item === 'object') {
          addName(item.name);
        }
      });
    }
    
    return names;
  } catch (error) {
    console.error('Error parsing analysis data:', error);
    return []; // Always return array, never throw
  }
};

/**
 * Check if the food already exists in the current meal time slot
 * Edge cases: network errors, invalid userId, null data, timezone issues, concurrent requests
 * @param {Object} params
 * @param {string} params.userId - User ID
 * @param {Object} params.analysisResult - Analysis result containing food names
 * @returns {Promise<Object>} { isDuplicate: boolean, duplicateFoodName: string, mealType: string }
 */
export async function checkForDuplicateFood({ userId, analysisResult }) {
  try {
    // Edge case: Missing or invalid userId
    if (!userId || (typeof userId !== 'string' && typeof userId !== 'number')) {
      console.warn('Invalid userId provided to duplicate check:', userId);
      return { isDuplicate: false };
    }
    
    // Edge case: Missing or invalid analysis result
    if (!analysisResult || typeof analysisResult !== 'object') {
      console.warn('Invalid analysis result provided to duplicate check');
      return { isDuplicate: false };
    }
    
    // Get current meal category and time range
    const currentTime = new Date();
    
    // Edge case: Invalid date (system clock issues)
    if (isNaN(currentTime.getTime())) {
      console.warn('Invalid system time detected');
      return { isDuplicate: false };
    }
    
    const mealCategory = getMealCategory(currentTime);
    const mealCategoryName = getMealCategoryName(mealCategory);
    
    // Extract food names from the new analysis
    const newFoodNames = extractFoodNames(analysisResult);
    
    // Edge case: No valid food names extracted
    if (!Array.isArray(newFoodNames) || newFoodNames.length === 0) {
      // console.log('No food names found in analysis result');
      return { isDuplicate: false };
    }
    
    // console.log('🔍 Checking for duplicates:', { newFoodNames, mealCategory, mealCategoryName });
    
    // Fetch today's nutrition data for the user
    const dateString = currentTime.toISOString().split('T')[0];
    const apiBaseUrl = process.env.REACT_APP_API_BASE_URL ;
    
    // Edge case: API base URL not configured
    if (!apiBaseUrl) {
      console.warn('REACT_APP_API_BASE_URL not configured');
      return { isDuplicate: false };
    }
    
    let response;
    try {
      response = await fetch(
        `${apiBaseUrl}/api/user-nutrition-stats?userId=${userId}&date=${dateString}&detailed=true`
      );
    } catch (fetchError) {
      // Edge case: Network error or offline
      console.error('Network error during duplicate check:', fetchError);
      return { isDuplicate: false }; // Fail-open on network errors
    }
    
    // Edge case: Non-OK HTTP response
    if (!response.ok) {
      console.error('Failed to fetch nutrition stats, status:', response.status);
      return { isDuplicate: false };
    }
    
    let data;
    try {
      data = await response.json();
    } catch (jsonError) {
      // Edge case: Invalid JSON response
      console.error('Invalid JSON response from nutrition stats:', jsonError);
      return { isDuplicate: false };
    }
    
    // Edge case: API returned success=false or no data
    if (!data || !data.success || !Array.isArray(data.data)) {
      // console.log('No valid nutrition data returned');
      return { isDuplicate: false };
    }
    
    // Edge case: Empty data array (no meals today)
    if (data.data.length === 0) {
      return { isDuplicate: false };
    }
    
    // Filter meals in the current time slot
    const mealsInCurrentSlot = data.data.filter(meal => {
      // Edge case: Missing or invalid meal data
      if (!meal || typeof meal !== 'object') return false;
      
      // Edge case: Missing CreatedAt timestamp
      if (!meal.CreatedAt) {
        console.warn('Meal missing CreatedAt timestamp:', meal);
        return false;
      }
      
      try {
        const mealTime = new Date(meal.CreatedAt);
        
        // Edge case: Invalid date
        if (isNaN(mealTime.getTime())) {
          console.warn('Invalid meal timestamp:', meal.CreatedAt);
          return false;
        }
        
        const mealCat = getMealCategory(mealTime);
        return mealCat === mealCategory;
      } catch (error) {
        console.error('Error processing meal time:', error);
        return false;
      }
    });
    
    // console.log('📊 Meals in current slot:', mealsInCurrentSlot.length);
    
    // Edge case: No meals in current time slot
    if (mealsInCurrentSlot.length === 0) {
      return { isDuplicate: false };
    }
    
    // Check if any new food name matches existing meals in this time slot
    for (const meal of mealsInCurrentSlot) {
      // Edge case: Meal missing AnalysisData
      if (!meal.AnalysisData) {
        console.warn('Meal missing AnalysisData:', meal.ID);
        continue;
      }
      
      const existingFoodNames = parseAnalysisData(meal.AnalysisData);
      
      // Edge case: Failed to parse existing food names
      if (!Array.isArray(existingFoodNames) || existingFoodNames.length === 0) {
        continue;
      }
      
      for (const newFoodName of newFoodNames) {
        // Edge case: Invalid food name (shouldn't happen but be safe)
        if (!newFoodName || typeof newFoodName !== 'string') continue;
        
        for (const existingFoodName of existingFoodNames) {
          // Edge case: Invalid existing food name
          if (!existingFoodName || typeof existingFoodName !== 'string') continue;
          
          // Simple exact match (case-insensitive)
          if (newFoodName === existingFoodName) {
            // console.log('✅  found:', { newFoodName, existingFoodName, mealCategoryName });
            
            // Edge case: Get original food name with proper casing for display
            let originalName = newFoodName;
            try {
              const parsedOriginal = typeof meal.AnalysisData === 'string' 
                ? JSON.parse(meal.AnalysisData) 
                : meal.AnalysisData;
              
              // Try to get the original casing from first food item
              if (parsedOriginal?.foods?.[0]?.name) {
                originalName = parsedOriginal.foods[0].name;
              } else if (parsedOriginal?.detailedItems?.[0]?.name) {
                originalName = parsedOriginal.detailedItems[0].name;
              } else if (parsedOriginal?.category?.name) {
                originalName = parsedOriginal.category.name;
              }
            } catch (e) {
              // Use lowercase version if can't get original
            }
            
            return {
              isDuplicate: true,
              duplicateFoodName: newFoodName,
              mealType: mealCategoryName,
              originalFoodName: originalName
            };
          }
        }
      }
    }
    
    return { isDuplicate: false };
    
  } catch (error) {
    console.error('Error checking for duplicate food:', error);
    // On error, allow the save to proceed (fail-open)
    return { isDuplicate: false };
  }
}

/**
 * Check if a similar weight entry already exists today
 * @param {Object} params
 * @param {string} params.userId - User ID
 * @param {number} params.weightValue - Weight value to check
 * @param {string} params.unit - Weight unit (kg or lbs)
 * @returns {Promise<Object>} { isDuplicate: boolean, existingWeight: number, timeDifference: string }
 */
export async function checkForDuplicateWeight({ userId, weightValue, unit = 'kg' }) {
  try {
    // Edge case: Missing or invalid userId
    if (!userId || (typeof userId !== 'string' && typeof userId !== 'number')) {
      console.warn('Invalid userId provided to weight duplicate check:', userId);
      return { isDuplicate: false };
    }
    
    // Edge case: Missing or invalid weight value
    if (!weightValue || isNaN(parseFloat(weightValue))) {
      console.warn('Invalid weight value provided to duplicate check:', weightValue);
      return { isDuplicate: false };
    }
    
    const currentTime = new Date();
    
    // Edge case: Invalid date (system clock issues)
    if (isNaN(currentTime.getTime())) {
      console.error('Invalid system time detected');
      return { isDuplicate: false };
    }
    
    const apiBaseUrl = process.env.REACT_APP_API_BASE_URL ;
    
    // Edge case: API base URL not configured
    if (!apiBaseUrl) {
      console.error('REACT_APP_API_BASE_URL not configured');
      return { isDuplicate: false };
    }
    
    // console.log('🔍 Checking for duplicate weight:', { userId, weightValue, unit });
    
    // Fetch today's weight history for the user
    let response;
    try {
      response = await fetch(
        `${apiBaseUrl}/api/get-weight-history?userId=${userId}&limit=50&offset=0`
      );
    } catch (fetchError) {
      // Edge case: Network error or offline
      console.error('Network error during weight duplicate check:', fetchError);
      return { isDuplicate: false }; // Fail-open on network errors
    }
    
    // Edge case: Non-OK HTTP response
    if (!response.ok) {
      console.error('Failed to fetch weight history for duplicate check, status:', response.status);
      return { isDuplicate: false };
    }
    
    let data;
    try {
      data = await response.json();
    } catch (jsonError) {
      // Edge case: Invalid JSON response
      console.error('Invalid JSON response from weight history:', jsonError);
      return { isDuplicate: false };
    }
    
    // Edge case: API returned success=false or no data
    if (!data || !data.success || !Array.isArray(data.data)) {
      // console.log('No valid weight history data returned');
      return { isDuplicate: false };
    }
    
    // Edge case: Empty data array (no weight entries)
    if (data.data.length === 0) {
      return { isDuplicate: false };
    }
    
    // Filter entries from today
    const todayStart = new Date(currentTime);
    todayStart.setHours(0, 0, 0, 0);
    
    const todayEntries = data.data.filter(entry => {
      // Edge case: Missing or invalid entry data
      if (!entry || typeof entry !== 'object') return false;
      
      // Edge case: Missing CreatedAt timestamp
      if (!entry.CreatedAt) {
        console.warn('Weight entry missing CreatedAt timestamp:', entry);
        return false;
      }
      
      try {
        const entryDate = new Date(entry.CreatedAt);
        
        // Edge case: Invalid date
        if (isNaN(entryDate.getTime())) {
          console.warn('Invalid weight entry timestamp:', entry.CreatedAt);
          return false;
        }
        
        return entryDate >= todayStart;
      } catch (error) {
        console.error('Error processing weight entry time:', error);
        return false;
      }
    });
    
    // console.log('📊 Weight entries today:', todayEntries.length);
    
    // Edge case: No weight entries today
    if (todayEntries.length === 0) {
      return { isDuplicate: false };
    }
    
    // Check if any entry has the same or very similar weight (within 0.5 kg/lbs tolerance)
    const tolerance = 0.5;
    const newWeight = parseFloat(weightValue);
    
    // Edge case: Invalid weight value after parsing
    if (isNaN(newWeight)) {
      console.warn('Invalid weight value after parsing:', weightValue);
      return { isDuplicate: false };
    }
    
    for (const entry of todayEntries) {
      // Edge case: Entry missing Weight field
      if (!entry.Weight) {
        console.warn('Weight entry missing Weight field:', entry);
        continue;
      }
      
      const existingWeight = parseFloat(entry.Weight);
      
      // Edge case: Invalid existing weight
      if (isNaN(existingWeight)) {
        console.warn('Invalid existing weight value:', entry.Weight);
        continue;
      }
      
      const weightDiff = Math.abs(newWeight - existingWeight);
      
      if (weightDiff <= tolerance) {
        // Found a duplicate or very similar weight
        try {
          const entryTime = new Date(entry.CreatedAt);
          const timeDiffMs = currentTime - entryTime;
          const timeDiffHours = Math.floor(timeDiffMs / (1000 * 60 * 60));
          const timeDiffMinutes = Math.floor((timeDiffMs % (1000 * 60 * 60)) / (1000 * 60));
          
          let timeDifference;
          if (timeDiffHours > 0) {
            timeDifference = `${timeDiffHours} hour${timeDiffHours > 1 ? 's' : ''} ago`;
          } else if (timeDiffMinutes > 0) {
            timeDifference = `${timeDiffMinutes} minute${timeDiffMinutes > 1 ? 's' : ''} ago`;
          } else {
            timeDifference = 'just now';
          }
          
          console.log('✅ Duplicate weight found:', { 
            newWeight, 
            existingWeight, 
            weightDiff, 
            timeDifference 
          });
          
          return {
            isDuplicate: true,
            existingWeight: existingWeight,
            timeDifference: timeDifference,
            unit: unit
          };
        } catch (timeError) {
          // Edge case: Error calculating time difference
          console.error('Error calculating time difference:', timeError);
          // Still return duplicate, just without time difference
          return {
            isDuplicate: true,
            existingWeight: existingWeight,
            timeDifference: 'recently',
            unit: unit
          };
        }
      }
    }
    
    return { isDuplicate: false };
    
  } catch (error) {
    console.error('Error checking for duplicate weight:', error);
    // On error, allow the save to proceed (fail-open)
    return { isDuplicate: false };
  }
}

export const duplicateDetectionService = {
  checkForDuplicateFood,
  checkForDuplicateWeight,
  getMealCategory,
  getMealCategoryName,
  extractFoodNames
};
