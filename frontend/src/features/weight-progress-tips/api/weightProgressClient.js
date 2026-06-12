/**
 * weightProgressClient.js
 * API client for weight progress tips endpoints.
 *
 * Endpoints:
 *   GET  /api/weight-progress-tips/check          — detect reverse progress
 *   POST /api/weight-progress-tips/submit-review  — persist accountability review
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

  const url = `${API_BASE_URL}/api/weight-progress-tips/check?${params}`;
  console.log('🌐 [weightProgressClient] Fetching:', url);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
    },
    cache: 'no-store',
    // Don't include credentials - not needed for this endpoint
  });

  console.log('📥 [weightProgressClient] Response status:', response.status);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('❌ [weightProgressClient] Error response:', errorData);
    throw new Error(errorData.error?.message || `HTTP ${response.status}`);
  }

  const result = await response.json();
  console.log('✅ [weightProgressClient] Success response:', result);
  
  if (!result.ok) {
    console.error('❌ [weightProgressClient] API returned ok=false:', result.error);
    throw new Error(result.error?.message || 'Unknown error');
  }

  return result.data;
}

/**
 * Submit the user's accountability review after a reverse-progress alert.
 *
 * @param {object} payload  Validated review payload.
 * @returns {Promise<{ weightRecordId: number, message: string }>}
 * @throws {Error}
 */
export async function submitProgressReview(payload) {
  const API_BASE_URL = getApiBaseUrl();
  const url = `${API_BASE_URL}/api/weight-progress-tips/submit-review`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(result.error?.message || `HTTP ${response.status}`);
  }
  if (!result.ok) {
    throw new Error(result.error?.message || 'Unknown error');
  }

  return result.data;
}
