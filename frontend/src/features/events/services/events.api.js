import { apiFetch } from '../../../shared/services/apiFetch.js';
import { getApiBaseUrl } from '../../../config/api.config.js';

export const EVENTS_UPDATED_EVENT = 'wellness-events-updated';

function endpoint() {
  return `${getApiBaseUrl()}/api/events`;
}

export function notifyEventsUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(EVENTS_UPDATED_EVENT));
  }
}

async function readJson(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.success === false) {
    const error = new Error(data?.message || 'Could not save the event.');
    error.status = res.status;
    error.code = data?.code || '';
    error.amountRequired = data?.amountRequired;
    error.body = data;
    throw error;
  }
  return data;
}

export function listEvents(userId) {
  const url = `${endpoint()}?userId=${encodeURIComponent(userId)}`;
  return apiFetch(url, { cache: 'no-store' }).then(readJson);
}

/** Registrable events for Wellness Events (not owner-only). */
export function listOpenEvents(userId) {
  const url = `${endpoint()}/open?userId=${encodeURIComponent(userId)}`;
  return apiFetch(url, { cache: 'no-store' }).then(readJson);
}

export function createEvent(payload) {
  return apiFetch(endpoint(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then(readJson);
}

export function updateEvent(payload) {
  return apiFetch(endpoint(), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then(readJson);
}

export function deleteEvent(payload) {
  return apiFetch(endpoint(), {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then(readJson);
}

export async function searchEventPeople({ userId, q }) {
  const params = new URLSearchParams({ userId: String(userId) });
  if (q) params.set('q', q);
  const res = await apiFetch(`${endpoint()}/people?${params.toString()}`, { cache: 'no-store' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.success === false) {
    const error = new Error(data?.message || 'Could not load people.');
    error.status = res.status;
    throw error;
  }
  return Array.isArray(data.people) ? data.people : [];
}

export function createEventRegistration(payload) {
  return apiFetch(`${endpoint()}/registrations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then(readJson);
}

export function listMyEventRegistrations(userId) {
  const url = `${endpoint()}/registrations?userId=${encodeURIComponent(userId)}`;
  return apiFetch(url, { cache: 'no-store' }).then(readJson);
}

export function getMyEventRegistration(userId, id) {
  const url = `${endpoint()}/registrations?userId=${encodeURIComponent(userId)}&id=${encodeURIComponent(id)}`;
  return apiFetch(url, { cache: 'no-store' }).then(readJson);
}

export function checkInEventRegistration(payload) {
  return apiFetch(`${endpoint()}/check-in`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then(readJson);
}

/** Entry pass Report — emails guest + coach; does not verify check-in. */
export function reportEventCheckInMisuse(payload) {
  return apiFetch(`${endpoint()}/check-in-report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then(readJson);
}
