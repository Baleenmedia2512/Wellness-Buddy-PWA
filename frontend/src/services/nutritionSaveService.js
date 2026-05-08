/**
 * Transform analysis result to match background service format
 * Background service format: { foods: [...], total: {...}, confidence: "..." }
 * Manual save format: { nutrition: {...}, detailedItems: [...], confidence: "..." }
 */
function transformToBackgroundServiceFormat(analysisResult) {
  try {
    if (!analysisResult) return analysisResult;
    
    // If already in background service format (has foods and total), return as-is
    if (analysisResult.foods && analysisResult.total) {
      return analysisResult;
    }
    
    // If in manual save format (has nutrition object), transform it
    if (analysisResult.nutrition) {
      const nutrition = analysisResult.nutrition;
      const detailedItems = analysisResult.detailedItems || [];
      
      // Create foods array from detailedItems if available, or create single food item
      const foods = detailedItems.length > 0 
        ? detailedItems.map(item => ({
            name: item.name || 'Unknown Food',
            // 🔴 CRITICAL: Preserve correction metadata for database persistence
            originalAiName: item.originalAiName || item.name,
            wasAutoCorrected: item.wasAutoCorrected || false,
            correctionSource: item.correctionSource || null,
            correctionMetadata: item.correctionMetadata || null,
            portion: item.portionDescription || item.portion || '1 serving',
            weight_g: typeof item.estimatedWeight === 'number' ? item.estimatedWeight : (item.weight_g || 100),
            volume_ml: item.volume_ml || null,
            unit: item.unit || 'g',
            isLiquid: item.isLiquid || false,
            nutrition: {
              calories: item.calories || item.nutrition?.calories || 0,
              protein: item.protein || item.nutrition?.protein || 0,
              carbs: item.carbs || item.nutrition?.carbs || 0,
              fat: item.fat || item.nutrition?.fat || 0,
              fiber: item.fiber || item.nutrition?.fiber || 0
            }
          }))
        : [{
            name: analysisResult.category?.name || 'Unknown Food',
            portion: '1 serving',
            weight_g: 100,
            nutrition: {
              calories: nutrition.calories || 0,
              protein: nutrition.protein || 0,
              carbs: nutrition.carbs || 0,
              fat: nutrition.fat || 0,
              fiber: nutrition.fiber || 0
            }
          }];
      
      // Create total object from nutrition
      const total = {
        calories: nutrition.calories || 0,
        protein: nutrition.protein || 0,
        carbs: nutrition.carbs || 0,
        fat: nutrition.fat || 0,
        fiber: nutrition.fiber || 0
      };
      
      return {
        foods: foods,
        total: total,
        confidence: analysisResult.confidence || 'medium'
      };
    }
    
    // If in unknown format, return as-is
    return analysisResult;
    
  } catch (error) {
    console.error('[transformToBackgroundServiceFormat] Error transforming data:', error);
    return analysisResult; // Return original if transformation fails
  }
}

/**
 * Utility to lookup the real UserID from team_table based on email
 * Returns: { success, userId, ... }
 */
export async function lookupUserId(email) {
  const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;
  try {
    const res = await fetch(`${apiBaseUrl}/api/lookup-user-id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to lookup user ID');
    return data;
  } catch (err) {
    console.error('[lookupUserId] Error:', err);
    throw err;
  }
}

/**
/**
 * Utility to upload nutrition analysis result to backend DB
 * Always uses the real UserID from team_table for consistency
 * Accepts imageBase64 (data URL or raw base64) and sends it to the backend as ImageBase64
 * Returns: { success, id, ... }
 */
export async function saveNutritionAnalysis({ userId, imagePath, imageBase64, analysisResult, deviceInfo, userEmail, captureTimestamp = null }) {
  const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;
  
  try {
    // 🔒 Demo account — skip DB save entirely, return fake success
    if (userId === 'DEMO_USER' || (userEmail && ['testereasywork@gmail.com'].includes(userEmail.toLowerCase().trim()))) {
      console.log('ℹ️ [saveNutritionAnalysis] Demo account — skipping DB save');
      return { success: true, id: 'demo-' + Date.now(), insertId: null };
    }

    // Always lookup the real UserID from team_table
    let actualUserId = userId;
    let actualUserEmail = userEmail; // Store email for logging
    
    // If userId looks like an email, lookup the team_table UserID
    if (userId && String(userId).includes('@')) {
      try {
        const lookupResult = await lookupUserId(userId);
        if (lookupResult.success && lookupResult.userId) {
          actualUserId = lookupResult.userId;
        } else {
          console.warn('[saveNutritionAnalysis] No UserID found in team_table for:', userId);
          throw new Error('User not found in team_table. Please contact support.');
        }
      } catch (lookupErr) {
        console.error('[saveNutritionAnalysis] UserID lookup failed:', lookupErr.message);
        throw new Error(`Unable to save: ${lookupErr.message}`);
      }
    } else if (userId && !isNaN(userId)) {
      // If it's already a numeric ID, use it directly
      actualUserId = userId;
    } else {
      // Handle other cases (uid, anonymous, etc.)
      console.warn('[saveNutritionAnalysis] Non-email userId provided:', userId);
      throw new Error('Please log in with a valid email to save nutrition data.');
    }
    
    // Transform analysisResult to match background service format (foods array + total object)
    const transformedAnalysisResult = transformToBackgroundServiceFormat(analysisResult);
    
    const res = await fetch(`${apiBaseUrl}/api/save-background-analysis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        userId: actualUserId, 
        imagePath, 
        ImageBase64: imageBase64, 
        analysisResult: transformedAnalysisResult, 
        deviceInfo,
        userEmail: actualUserEmail,
        // Use EXIF capture timestamp if available — so meal is categorised by WHEN it was eaten,
        // not when it was uploaded. Falls back to upload time if EXIF is missing.
        clientTimestamp: captureTimestamp || new Date().toISOString(),
        clientTimezoneOffset: new Date().getTimezoneOffset()
      })
    });
    
    // Check if response is JSON before parsing
    const contentType = res.headers.get('content-type');
    let data;
    
    if (contentType && contentType.includes('application/json')) {
      data = await res.json();
    } else {
      // Handle non-JSON responses (like HTML error pages)
      const text = await res.text();
      console.error('Non-JSON response:', text);
      
      if (text.includes('Body exceeded') || text.includes('Request entity too large')) {
        throw new Error('Image file is too large. Please try with a smaller image (max 10MB).');
      }
      
      if (res.status === 500) {
        throw new Error('Internal Server Error');
      }
      
      if (res.status === 503) {
        throw new Error('Server is currently overloaded');
      }
      
      throw new Error('Server returned an unexpected response format');
    }
    
    if (!res.ok) throw new Error(data.message || 'Failed to save analysis');
    return data;
  } catch (err) {
    console.error('[saveNutritionAnalysis] Error:', err);
    throw err;
  }
}

/**
 * Utility to delete a saved nutrition analysis by ID
 * Note: This function works with analysis IDs, not UserIDs, so no lookup needed
 */
export async function deleteNutritionAnalysis({ id, userId }) {
  const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;
  try {
    const res = await fetch(`${apiBaseUrl}/api/delete-background-analysis`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, userId })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to delete analysis');
    return data;
  } catch (err) {
    console.error('[deleteNutritionAnalysis] Error:', err);
    throw err;
  }
}
