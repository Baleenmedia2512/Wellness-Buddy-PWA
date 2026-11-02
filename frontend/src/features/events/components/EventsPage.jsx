import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  MapPin,
  Users,
} from 'lucide-react';
import { getUserId } from '../../../shared/services/getUserId.js';
import { listEvents } from '../services/events.api.js';

const CARD_STYLES = [
  {
    card: 'border-teal-300 bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-700',
    badge: 'bg-white/20 text-white',
    button: 'bg-white text-teal-800 hover:bg-teal-50 focus-visible:ring-white',
  },
  {
    card: 'border-amber-300 bg-gradient-to-br from-orange-500 via-amber-500 to-rose-500',
    badge: 'bg-white/20 text-white',
    button: 'bg-white text-orange-800 hover:bg-orange-50 focus-visible:ring-white',
  },
  {
    card: 'border-violet-300 bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600',
    badge: 'bg-white/20 text-white',
    button: 'bg-white text-violet-800 hover:bg-violet-50 focus-visible:ring-white',
  },
];

const STATUS_STYLES = {
  scheduled: 'bg-white/20 text-white',
  postponed: 'bg-amber-100 text-amber-900',
  cancelled: 'bg-rose-100 text-rose-900',
};

const STATUS_LABELS = {
  scheduled: 'Scheduled',
  postponed: 'Postponed',
  cancelled: 'Cancelled',
};

function formatTicketPrice(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 'Not specified';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount);
}

function EventsPage({ user }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [name, setName] = useState('');
  const [submittedName, setSubmittedName] = useState('');

  useEffect(() => {
    let active = true;

    const loadEvents = async () => {
      setLoading(true);
      setLoadError('');

      try {
        const userId = await getUserId(user);
        if (!userId) {
          throw new Error('Could not identify your account to load events.');
        }

        const result = await listEvents(userId);
        if (active) {
          setEvents(Array.isArray(result.events) ? result.events : []);
        }
      } catch (error) {
        if (active) {
          setLoadError(error?.message || 'Could not load events. Please try again.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    loadEvents();
    return () => {
      active = false;
    };
  }, [user]);

  const openRegistration = (event) => {
    setSelectedEvent(event);
    setName('');
    setSubmittedName('');
  };

  const closeRegistration = () => {
    setSelectedEvent(null);
    setName('');
    setSubmittedName('');
  };

  const submitRegistration = (formEvent) => {
    formEvent.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;
    setSubmittedName(trimmedName);
  };

  return (
    <main className="min-h-full bg-gray-50 px-3 py-5 sm:px-5">
      <div className="mx-auto max-w-2xl">
        {selectedEvent ? (
          <section aria-labelledby="event-registration-title">
            <button
              type="button"
              onClick={closeRegistration}
              className="mb-4 inline-flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to events
            </button>

            <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-700 p-5 shadow-sm sm:p-6">
              <span className="inline-flex rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white">
                {STATUS_LABELS[selectedEvent.status] || selectedEvent.status}
              </span>
              <h1 id="event-registration-title" className="mt-3 text-xl font-bold text-white">
                Register interest in {selectedEvent.eventName}
              </h1>
              <p className="mt-1 text-sm leading-6 text-white/95">
                Enter your name to register your interest. This demo does not save or send registration details.
              </p>

              {submittedName ? (
                <div role="status" className="mt-5 rounded-xl border border-white/80 bg-white/90 p-4 text-sm text-gray-800">
                  <p className="flex items-center gap-2 font-semibold text-emerald-800">
                    <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                    Thank you, {submittedName}!
                  </p>
                  <p className="mt-1">Your interest has been noted for this demo only; it has not been saved.</p>
                </div>
              ) : (
                <form onSubmit={submitRegistration} className="mt-5 rounded-xl border border-white/80 bg-white/90 p-4">
                  <label htmlFor="event-registration-name" className="block text-sm font-semibold text-gray-900">
                    Name
                  </label>
                  <input
                    id="event-registration-name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    maxLength={80}
                    required
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                    placeholder="Enter your name"
                  />
                  <button
                    type="submit"
                    className="mt-4 w-full rounded-lg bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2"
                  >
                    Submit registration
                  </button>
                </form>
              )}
            </div>
          </section>
        ) : (
          <>
            <header className="mb-4">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100">
                  <CalendarDays className="h-6 w-6 text-emerald-800" aria-hidden="true" />
                </span>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Wellness Events</h1>
                  <p className="text-sm text-gray-600">Events added from the Create Event page.</p>
                </div>
              </div>
            </header>

            {loading ? (
              <p role="status" className="py-6 text-center text-sm text-gray-600">Loading events…</p>
            ) : loadError ? (
              <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                {loadError}
              </p>
            ) : events.length === 0 ? (
              <p className="rounded-xl border border-gray-200 bg-white p-5 text-center text-sm text-gray-600">
                No events have been created yet.
              </p>
            ) : (
              <section aria-label="Wellness events" className="mx-auto max-w-lg space-y-2.5">
                {events.map((event, index) => {
                  const style = CARD_STYLES[index % CARD_STYLES.length];
                  const status = String(event.status || 'scheduled').toLowerCase();
                  const designatedNames = (event.designatedPersons || [])
                    .map((person) => person?.name)
                    .filter(Boolean);

                  return (
                    <article
                      key={event.id}
                      className={`relative isolate overflow-hidden rounded-xl border p-3 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-4 ${style.card}`}
                    >
                      <div aria-hidden="true" className="pointer-events-none absolute -right-5 -top-6 -z-10 h-24 w-24 rounded-full bg-white/10 blur-sm" />
                      <div aria-hidden="true" className="pointer-events-none absolute -bottom-10 right-12 -z-10 h-20 w-20 rounded-full bg-cyan-200/20 blur-sm" />
                      <div className="flex items-start gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/30 bg-white/15 text-white shadow-inner">
                          <CalendarDays className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${style.badge}`}>
                              Wellness event
                            </span>
                            <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${STATUS_STYLES[status] || STATUS_STYLES.scheduled}`}>
                              {STATUS_LABELS[status] || status}
                            </span>
                          </div>
                          <h2 className="mt-1 truncate text-sm font-bold text-white sm:text-base">
                            {event.eventName}
                          </h2>
                          <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] leading-4 text-white/95 sm:text-xs">
                            <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                            {event.place}
                          </p>
                          <p className="mt-1 text-[10px] leading-4 text-white/85">
                            {event.eventDate} · Host: {event.hostName} · {formatTicketPrice(event.ticketPrice)} · {event.seatCount} seats
                          </p>
                          {designatedNames.length > 0 && (
                            <p className="mt-1 flex items-start gap-1 text-[10px] leading-4 text-white/85">
                              <Users className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                              <span className="truncate">For: {designatedNames.join(', ')}</span>
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="mt-2 flex justify-end border-t border-white/20 pt-2">
                        <button
                          type="button"
                          onClick={() => openRegistration(event)}
                          disabled={status === 'cancelled'}
                          className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-[11px] font-bold shadow-sm transition hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${style.button}`}
                        >
                          Register
                          <ArrowRight className="h-3 w-3" aria-hidden="true" />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}

export default EventsPage;
