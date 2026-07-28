/**
 * counsellingApi.js — slice service.
 * Single responsibility: persist and look up counselling assessments.
 * Uses CapacitorHttp so the call works on web AND native...
 */
import { CapacitorHttp } from '@capacitor/core';
import { getApiBaseUrl } from '../../../config/api.config.js';

/**
 * Persist a wellness counselling assessment.
 * @param {object} formData — full assessment payload built by the hook.
 * @returns {Promise<object>} server response body.
 * @throws Error when the server reports `success === false`.
 */
export async function saveAssessment(formData) {
  const response = await CapacitorHttp.post({
    url: `${getApiBaseUrl()}/api/counselling/save-assessment`,
    headers: { 'Content-Type': 'application/json' },
    data: formData,
  });
  const result = response.data;
  if (!result || result.success === false) {
    throw new Error(result?.message || 'Failed to save assessment');
  }
  return result;
}

/**
 * Fetch the most-recent counselling assessment for the logged-in user.
 * Used by the profile page to pre-fill fields the coach already captured.
 *
 * @param {number|string} userId
 * @returns {Promise<object|null>} assessment data or null if none found
 */
export async function fetchMyAssessment(userId) {
  if (!userId) return null;
  try {
    const response = await CapacitorHttp.get({
      url: `${getApiBaseUrl()}/api/counselling/my-assessment?userId=${encodeURIComponent(userId)}`,
    });
    const result = response.data;
    if (!result?.success || !result?.found) return null;
    return result.data;
  } catch {
    return null;
  }
}

/**
 * Look up an unlinked counselling lead record by mobile number.
 * Called when a lead registers on the app with the same mobile the coach
 * captured during their counselling session — returns the assessment so
 * the profile can be pre-filled with the counselling data (eating habits
 * diet type, health problems, etc.).
 *
 * @param {string} phone — mobile number (any format)
 * @returns {Promise<object|null>} assessment data or null
 */
export async function fetchLeadByPhone(phone) {
  if (!phone || phone.trim() === '') return null;
  try {
    const response = await CapacitorHttp.get({
      url: `${getApiBaseUrl()}/api/counselling/lead-by-phone?phone=${encodeURIComponent(phone.trim())}`,
    });
    const result = response.data;
    if (!result?.success || !result?.found) return null;
    return result.data;
  } catch {
    return null;
  }
}
