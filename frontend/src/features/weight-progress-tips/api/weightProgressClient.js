/**
 * weightProgressClient.js
 * API client for weight progress tips endpoints.
 */
import { getApiBaseUrl } from '../../../config/api.config.js';

/**
 * Check for reverse weight progress and fetch tips.
 * 
 * @param {number} userId - User ID
 * @param {number|null} currentWeightId - Optional specific weight record ID
 * @returns {Promise<object>} { shouldShow, comparison?, tips?, goalMode? }
 */
export async function fetchWeightProgressCheck(userId, currentWeightId = null) {
  const API_BASE_URL = getApiBaseUrl();
  const params = new URLSearchParams({ userId: userId.toString() });
  if (currentWeightId) {
    params.append('currentWeightId', currentWeightId.toString());
  }

  const response = await fetch(`${API_BASE_URL}/api/weight-progress-tips/check?${params}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    // Don't include credentials - not needed for this endpoint
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `HTTP ${response.status}`);
  }

  const result = await response.json();
  
  if (!result.ok) {
    throw new Error(result.error?.message || 'Unknown error');
  }

  return result.data;
}
