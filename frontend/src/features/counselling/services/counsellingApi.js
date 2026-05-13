/**
 * counsellingApi.js — slice service.
 * Single responsibility: persist a counselling assessment.
 * Uses CapacitorHttp so the call works on web AND native.
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
