/**
 * marathon.api.js — Network layer for the Marathon Recognition Engine.
 *
 * All URLs are built from getApiBaseUrl() per frontend.md §4.
 * Raw fetch — consistent with the existing pattern in this slice.
 */
import { getApiBaseUrl } from '../../../config/api.config.js';

const base = () => getApiBaseUrl();

async function get(path) {
  const res  = await fetch(`${base()}${path}`, { method: 'GET' });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || `GET ${path} failed`);
  return json;
}

async function post(path, payload) {
  const res  = await fetch(`${base()}${path}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || `POST ${path} failed`);
  return json;
}

// ─── Marathon management ───────────────────────────────────────────────────

export async function createMarathon(payload) {
  return post('/api/marathon/create', payload);
}

export async function deleteMarathon({ marathonId, coachId }) {
  return post('/api/marathon/delete', { marathonId, coachId });
}

export async function listMarathons({ coachId, status } = {}) {
  const qs = new URLSearchParams({ coachId });
  if (status) qs.append('status', status);
  return get(`/api/marathon/list?${qs}`);
}

export async function getCardData({ marathonId, cardType, coachId }) {
  const qs = new URLSearchParams({ marathonId, cardType, coachId });
  return get(`/api/marathon/get-card-data?${qs}`);
}

/**
 * Fetch eligible participant candidates for LAP creation.
 * Returns downline + upline chain — faster than full team-hierarchy.
 */
export async function getMarathonParticipants({ coachId, role = 'coach' }) {
  const qs = new URLSearchParams({ coachId, role });
  return get(`/api/marathon/participants?${qs}`);
}

// ─── Member lap dashboard ───────────────────────────────────────────────────

export async function getMyLaps(userId) {
  return get(`/api/marathon/my-laps?userId=${userId}`);
}

// ─── Leaderboard ────────────────────────────────────────────────────────────

export async function getLeaderboard({ marathonId, type = 'day', topN = 10 }) {
  const qs = new URLSearchParams({ marathonId, type, topN });
  return get(`/api/marathon/leaderboard?${qs}`);
}

// ─── Recognition ────────────────────────────────────────────────────────────

export async function getPendingRecognition(userId) {
  return get(`/api/marathon/recognition?userId=${userId}`);
}

export async function markRecognitionViewed({ userId, marathonId, resultDate }) {
  return post('/api/marathon/recognition', { userId, marathonId, resultDate });
}

// ─── Admin config ────────────────────────────────────────────────────────────

export async function getAdminConfig(marathonId) {
  return get(`/api/marathon/admin-config?marathonId=${marathonId}`);
}

export async function saveAdminConfig(payload) {
  return post('/api/marathon/admin-config', payload);
}

// ─── Finalize day ─────────────────────────────────────────────────────────────

export async function finalizeDay({ marathonId, coachId }) {
  return post('/api/marathon/finalize-day', { marathonId, coachId });
}
