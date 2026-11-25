/**
 * Bookings the member has already opened on My Bookings.
 * Those ids no longer raise the home-screen sign.
 */
import storage from '../../../shared/lib/storage';

export const EVENT_CANCEL_SEEN_EVENT = 'wv-event-cancel-seen';
const STORAGE_KEY = 'wv.eventCancelSeen';
const MAX_SEEN = 100;

export function readSeenEventCancellationIds() {
  try {
    const parsed = JSON.parse(storage.get(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.map((id) => String(id)) : [];
  } catch {
    return [];
  }
}

export function markEventCancellationsSeen(ids) {
  const next = new Set(readSeenEventCancellationIds());
  for (const id of ids || []) {
    if (id == null || String(id).trim() === '') continue;
    next.add(String(id));
  }
  const list = [...next].slice(-MAX_SEEN);
  storage.set(STORAGE_KEY, JSON.stringify(list));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(EVENT_CANCEL_SEEN_EVENT));
  }
}
