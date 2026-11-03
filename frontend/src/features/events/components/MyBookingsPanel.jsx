import React, { useEffect, useState } from 'react';
import { ArrowRight, CalendarDays, MapPin, Ticket, User } from 'lucide-react';
import { getUserId } from '../../../shared/services/getUserId.js';
import { listMyEventRegistrations } from '../services/events.api.js';
import RegistrationQrCard from './RegistrationQrCard.jsx';

const LIST_CARD_STYLES = [
  'from-emerald-600 via-teal-600 to-cyan-700',
  'from-orange-500 via-amber-500 to-rose-500',
  'from-violet-600 via-purple-600 to-fuchsia-600',
];

function formatMoney(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount);
}

function statusLabel(value) {
  const status = String(value || 'saved').toLowerCase();
  if (status === 'paid') return 'Paid';
  if (status === 'saved') return 'Saved';
  return status;
}

function BookingPassCard({ booking, onBack }) {
  const eventName = booking.event?.eventName || `Event #${booking.eventId}`;
  const hostName = booking.event?.hostName || '';
  const place = booking.event?.place || '—';
  const eventDate = booking.event?.eventDate || '—';
  const status = String(booking.paymentStatus || 'saved').toLowerCase();

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={onBack}
        className="text-sm font-semibold text-emerald-800 hover:underline"
      >
        ← Back to My Booking
      </button>

      <article className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">
        <div className="bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 px-4 py-4 text-white">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-white/85">
            Event booking pass
          </p>
          <h3 className="mt-1 text-xl font-bold leading-tight">{eventName}</h3>
          {hostName ? (
            <p className="mt-1 text-sm text-white/90">Host: {hostName}</p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1">
              <CalendarDays className="h-3 w-3" aria-hidden="true" />
              {eventDate}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1">
              <MapPin className="h-3 w-3" aria-hidden="true" />
              {place}
            </span>
          </div>
        </div>

        <div className="space-y-4 p-4">
          <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-3 text-sm text-gray-800">
            <p className="flex items-center gap-2 font-semibold text-gray-900">
              <User className="h-4 w-4 text-emerald-800" aria-hidden="true" />
              Guest details
            </p>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-xs sm:text-sm">
              <div>
                <dt className="text-gray-500">Name</dt>
                <dd className="font-medium text-gray-900">{booking.name || '—'}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Paid</dt>
                <dd className="font-medium text-gray-900">{formatMoney(booking.amountCharged)}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Status</dt>
                <dd className="font-medium capitalize text-gray-900">{status}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Entry code</dt>
                <dd className="font-bold tracking-widest text-emerald-900">{booking.entryCode || '—'}</dd>
              </div>
            </dl>
          </div>

          <RegistrationQrCard
            qrPayload={booking.qrPayload}
            entryCode={booking.entryCode}
            eventName={eventName}
            compact
          />
        </div>
      </article>
    </div>
  );
}

export default function MyBookingsPanel({ user }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const userId = await getUserId(user);
      if (!userId) {
        setError('Could not identify your account.');
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const data = await listMyEventRegistrations(userId);
        if (!cancelled) {
          setRows(Array.isArray(data.registrations) ? data.registrations : []);
          setError('');
        }
      } catch (err) {
        if (!cancelled) setError(err?.message || 'Could not load bookings.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (selected) {
    return <BookingPassCard booking={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <section aria-label="My Booking" className="space-y-3">
      <div className="flex items-center gap-2">
        <Ticket className="h-5 w-5 text-emerald-800" aria-hidden="true" />
        <h2 className="text-lg font-bold text-gray-900">My Booking</h2>
      </div>
      {loading ? (
        <p className="text-sm text-gray-600" role="status">Loading bookings…</p>
      ) : error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
          {error}
        </p>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600">
          No bookings yet. Register for an event to see your QR here.
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row, index) => {
            const eventName = row.event?.eventName || `Event #${row.eventId}`;
            const hostName = row.event?.hostName || '';
            const place = row.event?.place || '—';
            const eventDate = row.event?.eventDate || '—';
            const checkedIn = Boolean(row.checkedInAt);
            const gradient = LIST_CARD_STYLES[index % LIST_CARD_STYLES.length];
            return (
              <li key={row.id}>
                <button
                  type="button"
                  disabled={checkedIn}
                  aria-disabled={checkedIn}
                  onClick={() => {
                    if (checkedIn) return;
                    setSelected(row);
                  }}
                  className={`w-full overflow-hidden rounded-2xl border text-left shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
                    checkedIn
                      ? 'cursor-not-allowed border-gray-200 bg-gray-100 opacity-70 grayscale'
                      : 'border-emerald-100 bg-white transition hover:-translate-y-0.5 hover:shadow-lg'
                  }`}
                >
                  <div
                    className={`px-4 py-3.5 text-white ${
                      checkedIn ? 'bg-gradient-to-br from-gray-500 via-gray-600 to-gray-700' : `bg-gradient-to-br ${gradient}`
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/80">
                          My event booking
                        </p>
                        <p className="mt-1 truncate text-lg font-bold leading-tight">{eventName}</p>
                        {hostName ? (
                          <p className="mt-1 truncate text-xs text-white/90">Host · {hostName}</p>
                        ) : null}
                      </div>
                      <span className="shrink-0 rounded-full bg-white/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide">
                        {checkedIn ? 'Checked in' : statusLabel(row.paymentStatus)}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                      <span className="inline-flex items-center gap-1 rounded-full bg-black/15 px-2.5 py-1">
                        <CalendarDays className="h-3 w-3" aria-hidden="true" />
                        {eventDate}
                      </span>
                      <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-black/15 px-2.5 py-1">
                        <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                        <span className="truncate">{place}</span>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                        Entry code
                      </p>
                      <p
                        className={`mt-0.5 text-xl font-bold tracking-[0.18em] ${
                          checkedIn ? 'text-gray-500' : 'text-emerald-900'
                        }`}
                      >
                        {row.entryCode || '—'}
                      </p>
                      <p className="mt-1 text-xs text-gray-600">
                        Paid {formatMoney(row.amountCharged)}
                      </p>
                    </div>
                    {checkedIn ? (
                      <span className="inline-flex items-center rounded-lg bg-gray-200 px-3 py-2 text-xs font-semibold text-gray-600">
                        Used · locked
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900">
                        View pass
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
