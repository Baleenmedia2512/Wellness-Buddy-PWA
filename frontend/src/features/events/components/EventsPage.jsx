import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, CalendarDays, CheckCircle2 } from 'lucide-react';

const SAMPLE_EVENTS = [
  {
    id: 'community-wellness-walk',
    category: 'Community activity',
    title: 'Community Wellness Walk',
    description: 'Enjoy a relaxed group walk and build healthy daily habits together.',
    details: 'Date and venue to be announced. Contact your coach for updates.',
    cardClass: 'border-emerald-200 bg-gradient-to-br from-emerald-50 via-green-50 to-teal-100',
    badgeClass: 'bg-emerald-100 text-emerald-900',
    buttonClass: 'bg-emerald-700 hover:bg-emerald-800 focus-visible:ring-emerald-600',
  },
  {
    id: 'healthy-habits-workshop',
    category: 'Learning session',
    title: 'Healthy Habits Workshop',
    description: 'Explore practical ideas for balanced meals and routines that last.',
    details: 'Date and venue to be announced. Contact your coach for updates.',
    cardClass: 'border-sky-200 bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-100',
    badgeClass: 'bg-sky-100 text-sky-900',
    buttonClass: 'bg-blue-700 hover:bg-blue-800 focus-visible:ring-blue-600',
  },
  {
    id: 'wellness-challenge-kickoff',
    category: 'Wellness challenge',
    title: 'Wellness Challenge Kick-off',
    description: 'Set a personal goal and meet others in the wellness community.',
    details: 'Date and venue to be announced. Contact your coach for updates.',
    cardClass: 'border-violet-200 bg-gradient-to-br from-violet-50 via-purple-50 to-fuchsia-100',
    badgeClass: 'bg-violet-100 text-violet-900',
    buttonClass: 'bg-violet-700 hover:bg-violet-800 focus-visible:ring-violet-600',
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
              <h1 id="event-registration-title" className="mt-3 text-xl font-bold text-gray-900">
                Register for {selectedEvent.title}
              </h1>
              <p className="mt-1 text-sm leading-6 text-gray-700">
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
                  <p className="text-sm text-gray-600">Find your next wellness activity.</p>
                </div>
              </div>
              <p className="mt-3 text-xs leading-5 text-gray-600">
                Sample events only. Dates and venues are not confirmed; contact your coach for updates.
              </p>
            </header>

            <section aria-label="All events" className="space-y-3">
              {SAMPLE_EVENTS.map((event) => (
                <article
                  key={event.id}
                  className={`overflow-hidden rounded-2xl border p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5 ${event.cardClass}`}
                >
                  <div className="flex items-start gap-3">
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${event.badgeClass}`}>
                      <CalendarDays className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${event.badgeClass}`}>
                        {event.category}
                      </span>
                      <h2 className="mt-2 text-base font-bold text-gray-900 sm:text-lg">
                        {event.title}
                      </h2>
                      <p className="mt-1 text-sm leading-5 text-gray-700">
                        {event.description}
                      </p>
                      <p className="mt-2 text-xs leading-5 text-gray-600">
                        {event.details}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={() => openRegistration(event)}
                      className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${event.buttonClass}`}
                    >
                      Register
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
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
