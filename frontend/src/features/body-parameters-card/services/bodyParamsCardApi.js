/**
 * bodyParamsCardApi.js — Axios client for the body-parameters-card slice.
 * Uses CapacitorHttp so calls work on web AND native.
 */
import { CapacitorHttp } from '@capacitor/core';
import { getApiBaseUrl } from '../../../config/api.config.js';

/**
 * Create a new body-parameters card.
 * @param {object} payload
 * @returns {Promise<{ id, publicShareToken, shareExpiresAt, name }>}
 */
export async function createBodyParamsCard(payload) {
  const response = await CapacitorHttp.post({
    url: `${getApiBaseUrl()}/api/body-parameters-card/create`,
    headers: { 'Content-Type': 'application/json' },
    data: payload,
  });
  const result = response.data;
  if (!result?.success) throw new Error(result?.error?.message || result?.message || 'Failed to create card');
  return result.data;
}

/**
 * Update an existing body-parameters card.
 * @param {number} id - the card id to update
 * @param {object} payload - fields to update (same shape as create, plus id)
 * @returns {Promise<{ id, publicShareToken, shareExpiresAt, name }>}
 */
export async function updateBodyParamsCard(id, payload) {
  const response = await CapacitorHttp.patch({
    url: `${getApiBaseUrl()}/api/body-parameters-card/update`,
    headers: { 'Content-Type': 'application/json' },
    data: { ...payload, id },
  });
  const result = response.data;
  if (!result?.success) throw new Error(result?.error?.message || result?.message || 'Failed to update card');
  return result.data;
}

/**
 * Fetch a card by its public share token (unauthenticated).
 * @param {string} token
 * @returns {Promise<object>} card data
 */
export async function fetchPublicCard(token) {
  const response = await CapacitorHttp.get({
    url: `${getApiBaseUrl()}/api/body-parameters-card/public/${token}`,
  });
  const result = response.data;
  if (!result?.success) {
    const err = new Error(result?.error?.message || 'Card not found');
    err.code = result?.error?.code;
    err.status = response.status;
    throw err;
  }
  return result.data;
}

/**
 * Save a card's data to the logged-in user's profile.
 * @param {string} token
 * @param {number} requestingUserId
 * @returns {Promise<{ saved: boolean, data: object }>}
 */
export async function saveCardToProfile(token, requestingUserId) {
  const response = await CapacitorHttp.post({
    url: `${getApiBaseUrl()}/api/body-parameters-card/public/${token}`,
    headers: { 'Content-Type': 'application/json' },
    data: { requestingUserId },
  });
  const result = response.data;
  if (!result?.success) throw new Error(result?.error?.message || 'Failed to save card');
  return { saved: result.saved, data: result.data };
}
