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
 *     isDirect: boolean
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
  return result.data;
}
