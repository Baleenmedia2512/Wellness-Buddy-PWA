const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001';

/**
 * Save a food correction to the database
 * @param {number} userId - User ID
 * @param {string} aiDetected - Food name detected by AI
 * @param {string} userCorrected - Food name corrected by user
 * @returns {Promise} API response
 */
export const saveFoodCorrection = async (userId, aiDetected, userCorrected) => {
  try {
    console.log('[CORRECTION SERVICE] saveFoodCorrection called:', { userId, aiDetected, userCorrected });
    
    // Don't save if both names are the same
    if (aiDetected.trim().toLowerCase() === userCorrected.trim().toLowerCase()) {
      console.log('[CORRECTION SERVICE] ❌ Names are identical, skipping save');
      return { success: false, message: 'No correction needed' };
    }

    const url = `${API_BASE_URL}/api/save-food-correction`;
    console.log('[CORRECTION SERVICE] API URL:', url);
    
    const payload = {
      userId,
      aiDetected: aiDetected.trim(),
      userCorrected: userCorrected.trim()
    };
    console.log('[CORRECTION SERVICE] Payload:', payload);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    console.log('[CORRECTION SERVICE] Response status:', response.status);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('[CORRECTION SERVICE] ✅ Success:', data);
    return data;
  } catch (error) {
    console.error('[CORRECTION SERVICE] ❌ Error:', error);
    throw error;
  }
};

/**
 * Get all food corrections for a user
 * @param {number} userId - User ID
 * @returns {Promise} User's corrections
 */
export const getUserCorrections = async (userId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/get-food-corrections?userId=${userId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching user corrections:', error);
    throw error;
  }
};
