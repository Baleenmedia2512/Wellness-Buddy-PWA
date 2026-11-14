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
export function formatEventTime(timeStr) {
  if (!timeStr) return '';
  const match = /^(\d{1,2}):(\d{2})/.exec(String(timeStr).trim());
  if (!match) return String(timeStr);
  let hours = Number(match[1]);
  const minutes = match[2];
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${ampm}`;
}

export function formatEventTimeRange(start, end) {
  const s = formatEventTime(start);
  const e = formatEventTime(end);
  if (s && e) return `${s} - ${e}`;
  if (s) return s;
  if (e) return e;
  return '';
}

export function eventSpeakerNames(event) {
  if (Array.isArray(event?.speakers) && event.speakers.length > 0) {
    return event.speakers
      .map((speaker) => String(speaker?.name || '').trim())
      .filter(Boolean);
  }
  return String(event?.hostName || '')
    .split(' · ')
    .map((name) => name.trim())
    .filter(Boolean);
}

export function getEventDatesList(event) {
  if (Array.isArray(event?.eventDates) && event.eventDates.length > 0) {
    return event.eventDates.map((item) => {
      if (typeof item === 'string') return { date: item, startTime: null, endTime: null };
      return {
        date: item.date || item.eventDate || '',
        startTime: item.startTime || null,
        endTime: item.endTime || null,
      };
    }).filter((item) => Boolean(item.date));
  }
  if (event?.eventDate) {
    return [{
      date: event.eventDate,
      startTime: event.startTime || null,
      endTime: event.endTime || null,
    }];
  }
  return [];
}

export function formatEventScheduleSummary(event) {
  const dates = getEventDatesList(event);
  if (dates.length === 0) return '';
  if (dates.length === 1) {
    const single = dates[0];
    const time = formatEventTimeRange(single.startTime, single.endTime);
    return time ? `${single.date} · ${time}` : single.date;
  }
  const dateStrings = dates.map((d) => d.date).join(', ');
  return `${dateStrings} (${dates.length} dates)`;
}

export function getEventPlacesList(event) {
  if (Array.isArray(event?.places) && event.places.length > 0) {
    return event.places.map((item) => {
      if (typeof item === 'string') return { city: item, venue: null };
      return {
        city: item.city || item.place || '',
        venue: item.venue || null,
      };
    }).filter((item) => Boolean(item.city));
  }
  const city = event?.city || event?.place || '';
  if (city) {
    return [{
      city,
      venue: event?.venue || null,
    }];
  }
  return [];
}

export function formatEventPlacesSummary(event) {
  const places = getEventPlacesList(event);
  if (places.length === 0) return '';
  if (places.length === 1) {
    const single = places[0];
    return single.venue ? `${single.city} · ${single.venue}` : single.city;
  }
  return places.map((p) => (p.venue ? `${p.city} (${p.venue})` : p.city)).join(' · ');
}
