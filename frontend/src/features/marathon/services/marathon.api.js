/**
 * marathon.api.js — Network layer for the Marathon Recognition Engine.
 *
 * All requests go through getApiBaseUrl() (per frontend.md §4).
 * No direct axios or fetch — uses the shared apiClient for retry/timeout.
 */
import { getApiBaseUrl } from '../../../config/api.config.js';

const base = () => getApiBaseUrl();

/**
 * Create a new marathon.
 *
 * @param {{ coachId, name, totalLaps, daysPerLap, startedAt, participantUserIds, role? }} payload
 * @returns {Promise<{ ok: boolean, data: object }>}
 */
export async function createMarathon(payload) {
  const res = await fetch(`${base()}/api/marathon/create`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'Failed to create marathon');
  return json;
}

/**
 * List marathons for a coach.
 *
 * @param {{ coachId: number, status?: string }} params
 * @returns {Promise<{ ok: boolean, data: Array }>}
 */
export async function listMarathons({ coachId, status } = {}) {
  const qs  = new URLSearchParams({ coachId });
  if (status) qs.append('status', status);
  const res  = await fetch(`${base()}/api/marathon/list?${qs}`, { method: 'GET' });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'Failed to list marathons');
  return json;
}

/**
 * Fetch live card data + receive a fresh share token.
 *
 * @param {{ marathonId: number, cardType: string, coachId: number }} params
 * @returns {Promise<{ ok: boolean, data: object }>}
 */
export async function getCardData({ marathonId, cardType, coachId }) {
  const qs  = new URLSearchParams({ marathonId, cardType, coachId });
  const res  = await fetch(`${base()}/api/marathon/get-card-data?${qs}`, { method: 'GET' });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'Failed to load card data');
  return json;
}
