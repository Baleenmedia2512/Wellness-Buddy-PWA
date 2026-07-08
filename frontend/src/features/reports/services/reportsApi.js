/**
 * reportsApi.js — Network calls for the Reports feature.
 * All fetch logic for this feature lives here; components never call fetch directly.
 */
import { CapacitorHttp } from '@capacitor/core';
import { getApiBaseUrl } from '../../../config/api.config.js';

function base() {
  return `${getApiBaseUrl()}/api/reports`;
}

/**
 * Normalise API payload to { self, members }.
 * Supports current shape ({ self, members }) and legacy flat-array responses.
 */
export function normalizeDownlineWeightPayload(data) {
  if (!data) return { self: null, members: [] };
  if (Array.isArray(data)) {
    return { self: null, members: data };
  }
  return {
    self: data.self ?? null,
    members: Array.isArray(data.members) ? data.members : [],
  };
}

/**
 * Fetch weight status for the coach and every descendant in one request.
 *
 * @param {number} coachId
 * @returns {Promise<{
 *   self: {
 *     userId: number,
 *     userName: string,
 *     heightCm: number|null,
 *     currentWeight: number|null,
 *     idealMin: number|null,
 *     idealMax: number|null,
 *     status: 'above_ideal'|'below_ideal'|'on_track'|'no_weight'|'no_height'
 *   },
 *   members: Array<{
 *     userId: number,
 *     userName: string,
 *     heightCm: number|null,
 *     currentWeight: number|null,
 *     idealMin: number|null,
 *     idealMax: number|null,
 *     status: 'above_ideal'|'below_ideal'|'on_track'|'no_weight'|'no_height',
 *     isDirect: boolean,
 *     coachId: number
 *   }>
 * }>}
 */
export async function fetchDownlineWeightStatus(coachId) {
  const res = await CapacitorHttp.get({
    url: `${base()}/downline-weight-status?coachId=${encodeURIComponent(coachId)}`,
  });
  const result = res.data;
  if (!result?.success) {
    throw new Error(result?.message || 'Failed to fetch downline weight status');
  }
  return normalizeDownlineWeightPayload(result.data);
}
