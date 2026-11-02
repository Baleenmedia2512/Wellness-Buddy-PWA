import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, CalendarDays, CheckCircle2 } from 'lucide-react';

const SAMPLE_EVENTS = [
  {
    id: 'wellness-workshop',
    category: 'Sample event · Learning',
    title: 'Wellness Workshop',
    description: 'A friendly session with practical ideas for building healthy everyday habits.',
    details: 'Sample date: March 14, 2027 · Sample time: 10:00 AM · Sample venue: Community Wellness Center',
    cardClass: 'border-teal-300 bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-700',
    badgeClass: 'bg-white/20 text-white',
    buttonClass: 'bg-white text-teal-800 hover:bg-teal-50 focus-visible:ring-white',
  },
  {
    id: 'healthy-cooking-demo',
    category: 'Sample event · Nutrition',
    title: 'Healthy Cooking Demo',
    description: 'Discover simple meal-preparation ideas and take home inspiration for your weekly menu.',
    details: 'Sample date: March 21, 2027 · Sample time: 11:30 AM · Sample venue: Valley Community Kitchen',
    cardClass: 'border-amber-300 bg-gradient-to-br from-orange-500 via-amber-500 to-rose-500',
    badgeClass: 'bg-white/20 text-white',
    buttonClass: 'bg-white text-orange-800 hover:bg-orange-50 focus-visible:ring-white',
  },
  {
    id: 'community-fitness-meetup',
    category: 'Sample event · Community',
    title: 'Community Fitness Meetup',
    description: 'Move, connect, and enjoy an upbeat group activity for a range of fitness levels.',
    details: 'Sample date: March 28, 2027 · Sample time: 7:00 AM · Sample venue: Green Valley Park',
    cardClass: 'border-violet-300 bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600',
    badgeClass: 'bg-white/20 text-white',
    buttonClass: 'bg-white text-violet-800 hover:bg-violet-50 focus-visible:ring-white',
  },
];

function EventsPage() {
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [name, setName] = useState('');
  const [submittedName, setSubmittedName] = useState('');

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

            <div className={`rounded-2xl border p-5 shadow-sm sm:p-6 ${selectedEvent.cardClass}`}>
              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${selectedEvent.badgeClass}`}>
                {selectedEvent.category}
              </span>
              <h1 id="event-registration-title" className="mt-3 text-xl font-bold text-white">
                Register for {selectedEvent.title}
              </h1>
              <p className="mt-1 text-sm leading-6 text-white/95">
                {selectedEvent.description}
              </p>

              {submittedName ? (
                <div role="status" className="mt-5 rounded-xl border border-white/80 bg-white/80 p-4 text-sm text-gray-800">
                  <p className="flex items-center gap-2 font-semibold text-emerald-800">
                    <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                    Thank you, {submittedName}!
                  </p>
                  <p className="mt-1">
                    This is a demo confirmation only. Your name has not been saved or sent.
                  </p>
                </div>
              ) : (
                <form onSubmit={submitRegistration} className="mt-5 rounded-xl border border-white/80 bg-white/80 p-4">
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
                    className={`mt-4 w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${selectedEvent.buttonClass}`}
                  >
                    Submit registration
                  </button>
                  <p className="mt-2 text-xs text-gray-600">
                    Demo only. Your name will not be stored or sent.
                  </p>
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
                  <h1 className="text-2xl font-bold text-gray-900">Events</h1>
                  <p className="text-sm text-gray-600">Explore activities and register your interest.</p>
                </div>
              </div>
              <p className="mt-3 text-xs leading-5 text-gray-600">
                Sample events for preview only. Dates, times, and venues are examples and are not confirmed.
              </p>
            </header>

            <section aria-label="Sample events" className="mx-auto max-w-lg space-y-2.5">
              {SAMPLE_EVENTS.map((event) => (
                <article
                  key={event.id}
                  className={`relative isolate overflow-hidden rounded-xl border p-3 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-4 ${event.cardClass}`}
                >
                  <div aria-hidden="true" className="pointer-events-none absolute -right-5 -top-6 -z-10 h-24 w-24 rounded-full bg-white/10 blur-sm" />
                  <div aria-hidden="true" className="pointer-events-none absolute -bottom-10 right-12 -z-10 h-20 w-20 rounded-full bg-cyan-200/20 blur-sm" />
                  <div className="flex items-start gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/30 bg-white/15 text-white shadow-inner">
                      <CalendarDays className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-semibold backdrop-blur-sm ${event.badgeClass}`}>
                        {event.category}
                      </span>
                      <h2 className="mt-1 truncate text-sm font-bold text-white sm:text-base">
                        {event.title}
                      </h2>
                      <p className="mt-0.5 truncate text-[11px] leading-4 text-white/95 sm:text-xs">
                        {event.description}
                      </p>
                      <p className="mt-1 truncate text-[10px] leading-4 text-white/80">
                        {event.details}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 flex justify-end border-t border-white/20 pt-2">
                    <button
                      type="button"
                      onClick={() => openRegistration(event)}
                      className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-[11px] font-bold shadow-sm transition hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${event.buttonClass}`}
                    >
                      Register now
                      <ArrowRight className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </div>
                </article>
              ))}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

export default EventsPage;
