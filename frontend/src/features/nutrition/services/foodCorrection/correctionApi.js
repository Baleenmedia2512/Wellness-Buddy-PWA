// REST endpoints for food corrections (write + per-user read + reverse lookup).
import { cacheManager } from '../../../../shared/services/cacheManager';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000';

export const saveFoodCorrection = async (userId, aiDetected, userCorrected, correctedData = {}) => {
  try {
    console.log('[CORRECTION SERVICE] saveFoodCorrection called:', { userId, aiDetected, userCorrected, correctedData });

    if (aiDetected.trim().toLowerCase() === userCorrected.trim().toLowerCase()) {
      console.log('[CORRECTION SERVICE] Names are identical, skipping save');
      return { success: false, message: 'No correction needed' };
    }

    const url = `${API_BASE_URL}/api/food-corrections`;
    const payload = {
      userId,
      aiDetected: aiDetected.trim(),
      userCorrected: userCorrected.trim(),
      ...correctedData,
    };
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    console.log('[CORRECTION SERVICE] ✅ Success:', data);

    // Invalidate caches so the new correction applies immediately.
    cacheManager.clearPattern('foodCorrection');
    cacheManager.clearPattern('globalCorrections');
    cacheManager.clearPattern('reverseLookup');
    return data;
  } catch (error) {
    console.error('[CORRECTION SERVICE] Error:', error);
    throw error;
  }
};

export const getUserCorrections = async (userId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/food-corrections?userId=${userId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('Error fetching user corrections:', error);
    throw error;
  }
};

export const reverseLookupOriginalAiName = async (correctedName) => {
  const cacheKey = cacheManager.generateKey('reverseLookup', correctedName);
  return cacheManager.execute(
    cacheKey,
    async () => {
      console.log('[REVERSE-LOOKUP] Querying server for:', correctedName);
      const response = await fetch(
        `${API_BASE_URL}/api/token/reverse-lookup?correctedName=${encodeURIComponent(correctedName)}`,
        { method: 'GET', headers: { 'Content-Type': 'application/json' } },
      );
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      if (data.success && data.found) {
        console.log('✅ [REVERSE-LOOKUP] Found original AI name:', data.originalAiName);
        return data.originalAiName;
      }
      console.log('[REVERSE-LOOKUP] No correction mapping found');
      return null;
    },
    cacheManager.ttls.reverseLookup,
  );
};
