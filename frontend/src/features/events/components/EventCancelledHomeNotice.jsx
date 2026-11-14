/**
 * Home-screen sign for a cancelled booking.
 * Opens My Bookings. After that page has been seen, the sign stays off.
 */
import React, { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { isFlagEnabled } from '../../../config/featureFlags';
import { getUserId } from '../../../shared/services/getUserId.js';
import { listMyEventRegistrations } from '../services/events.api.js';
import {
  eventCancellationHomeCopy,
  unseenCancelledBookings,
} from '../domain/eventCancelNotice.rules.js';
import {
  EVENT_CANCEL_SEEN_EVENT,
  readSeenEventCancellationIds,
} from '../domain/eventCancelSeen.js';

export default function EventCancelledHomeNotice({ user, onOpenBookings }) {
  const [copy, setCopy] = useState(null);

  useEffect(() => {
    if (!isFlagEnabled('ff.events')) return undefined;
    let live = true;

    async function load() {
      try {
        const userId = await getUserId(user);
        if (!userId || !live) return;
        const data = await listMyEventRegistrations(userId);
        if (!live) return;
        const notes = unseenCancelledBookings(
          data?.registrations,
          readSeenEventCancellationIds(),
        );
        setCopy(eventCancellationHomeCopy(notes));
      } catch {
        if (live) setCopy(null);
      }
    }

    load();
    const onSeen = () => load();
    window.addEventListener(EVENT_CANCEL_SEEN_EVENT, onSeen);
    return () => {
      live = false;
      window.removeEventListener(EVENT_CANCEL_SEEN_EVENT, onSeen);
    };
  }, [user]);

  if (!copy) return null;

  return (
    <button
      type="button"
      onClick={onOpenBookings}
      className="mt-2 flex w-full min-w-0 max-w-full items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-2 text-left xs:mt-3 xs:gap-2.5 xs:px-3 xs:py-2.5"
      aria-label={`${copy.title}. ${copy.subtitle}`}
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-700 xs:h-8 xs:w-8">
        <Bell className="h-3.5 w-3.5 xs:h-4 xs:w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block break-words text-[13px] font-bold leading-snug text-rose-950 xs:text-sm">
          {copy.title}
        </span>
        <span className="mt-0.5 block break-words text-[13px] leading-snug text-rose-800/90 xs:text-xs">
          {copy.subtitle}
        </span>
      </span>
    </button>
  );
}
