/**
 * bodyParamsCardApi.js — Axios client for the body-parameters-card slice.
 * Uses CapacitorHttp so calls work on web AND native.
 */
import { CapacitorHttp } from '@capacitor/core';
import { getApiBaseUrl } from '../../../config/api.config.js';
import { getAppVersionHeaders } from '../../../shared/services/apiFetch.js';

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

/**
 * Search team members by phone number prefix (autocomplete).
 * Returns up to 10 matches scoped to the coach's team.
 *
 * @param {{ prefix: string, coachId: number }} opts
 * @returns {Promise<Array<{ userId: number, userName: string, phoneNumber: string, heightCm: number|null, bmr: number|null }>>}
 */
export async function searchPhonesByPrefix({ prefix, coachId }) {
  const response = await CapacitorHttp.get({
    url: `${getApiBaseUrl()}/api/body-parameters-card/phone-search?prefix=${encodeURIComponent(prefix)}&coachId=${encodeURIComponent(coachId)}`,
    headers: { 'Cache-Control': 'no-cache' },
  });
  const result = response.data;
  if (!result?.ok) throw new Error(result?.error?.message || 'Phone search failed');
  return Array.isArray(result.data) ? result.data : [];
}

/**
 * Prefill BCM fields from a member's profile + latest weight.
 * @param {{ userId: string|number, coachId: string|number }} opts
 * @returns {Promise<object>}
 */
export async function fetchMemberPrefill({ userId, coachId }) {
  const response = await CapacitorHttp.get({
    url: `${getApiBaseUrl()}/api/body-parameters-card/member-prefill?userId=${encodeURIComponent(userId)}&coachId=${encodeURIComponent(coachId)}`,
    headers: { 'Cache-Control': 'no-cache', ...getAppVersionHeaders() },
  });
  const result = response?.data;
  if (response?.status && response.status >= 400) {
    throw new Error(result?.error?.message || result?.message || `Member prefill failed (${response.status})`);
  }
  if (!result?.ok) throw new Error(result?.error?.message || 'Member prefill failed');
  return result.data || {};
}

/**
 * Soft-delete a body-parameters card owned by the coach.
 * @param {{ id: string|number, coachId: string|number }} opts
 * @returns {Promise<{ id: number }>}
 */
export async function deleteBodyParamsCard({ id, coachId }) {
  const response = await CapacitorHttp.delete({
    url: `${getApiBaseUrl()}/api/body-parameters-card/delete`,
    headers: { 'Content-Type': 'application/json' },
    data: { id, coachId },
  });
  const result = response.data;
  if (!result?.success) {
    throw new Error(result?.message || result?.error?.message || 'Failed to delete card');
  }
  return result.data;
}

/**
 * List body parameter cards for a coach (paginated).
 * @param {string|number} coachId
 * @param {{ page?: number, limit?: number, search?: string, signal?: AbortSignal }} [opts]
 * @returns {Promise<{ cards: Array, pagination: object }>}
 */
export async function listBodyParamsCards(coachId, opts = {}) {
  const page = opts.page ?? 1;
  const limit = opts.limit ?? 20;
  const search = opts.search ? String(opts.search).trim() : '';
  const params = new URLSearchParams({
    coachId: String(coachId),
    page: String(page),
    limit: String(limit),
  });
  if (search) params.set('search', search);

  const url = `${getApiBaseUrl()}/api/body-parameters-card/list?${params}`;
  const response = await CapacitorHttp.get({
    url,
    headers: { 'Cache-Control': 'no-cache' },
  });

  const result = response.data;
  if (!result?.ok) {
    throw new Error(result?.error?.message || 'Failed to list cards');
  }

  const cards = Array.isArray(result.data) ? result.data : [];
  const pagination = result.pagination || {
    totalRecords: cards.length,
    totalPages: 1,
    currentPage: page,
    pageSize: limit,
    hasNextPage: false,
    hasPreviousPage: false,
  };
  return { cards, pagination };
}

/**
 * Fetch a single full card for edit (all metric fields).
 * @param {string|number} coachId
 * @param {string|number} cardId
 * @returns {Promise<object>}
 */
export async function getBodyParamsCard(coachId, cardId) {
  const params = new URLSearchParams({
    coachId: String(coachId),
    cardId: String(cardId),
  });
  const response = await CapacitorHttp.get({
    url: `${getApiBaseUrl()}/api/body-parameters-card/list?${params}`,
    headers: { 'Cache-Control': 'no-cache' },
  });
  const result = response.data;
  if (!result?.ok) {
    throw new Error(result?.error?.message || 'Failed to load card');
  }
  return result.data;
}

/**
 * Dated body-parameter snapshots for Reports Trend.
 * @param {string|number} userId
 * @param {{ viewerUserId?: string|number }} [opts]
 * @returns {Promise<{ ok: boolean, status: number, data: object }>}
 */
export async function fetchBodyParamsCardHistory(userId, { viewerUserId } = {}) {
  const params = new URLSearchParams({ userId: String(userId) });
  params.set('_t', String(Date.now()));
  if (viewerUserId != null && viewerUserId !== '') {
    params.set('viewerUserId', String(viewerUserId));
  }
  const response = await CapacitorHttp.get({
    url: `${getApiBaseUrl()}/api/body-parameters-card/history?${params}`,
    headers: { 'Cache-Control': 'no-cache' },
  });
  const result = response.data;
  return {
    ok: response.status >= 200 && response.status < 300 && result?.ok === true,
    status: response.status,
    data: result,
  };
}
