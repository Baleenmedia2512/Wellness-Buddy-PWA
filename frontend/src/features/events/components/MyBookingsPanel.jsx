import React, { useEffect, useState } from 'react';
import { ArrowRight, CalendarDays, MapPin, Ticket, User } from 'lucide-react';
import wellnessValleyIcon from '../../../assets/wellness-valley-icon.png';
import { getUserId } from '../../../shared/services/getUserId.js';
import {
  formatEventScheduleSummary,
  formatEventTimeRange,
  eventSpeakerNames,
  listMyEventRegistrations,
} from '../services/events.api.js';
import RegistrationQrCard from './RegistrationQrCard.jsx';
import { shareTicketQrImage, ticketShareCaption } from '../utils/shareTicketQr.js';

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
  if (status === 'refunded') return 'Credit returned';
  return status;
}

function bookingCancelled(row) {
  const status = String(row?.event?.status || '').toLowerCase();
  if (status === 'cancelled') return true;
  return !row?.event;
}

function bookingCreditNote(row) {
  if (!bookingCancelled(row)) return '';
  const amount = Number(row?.amountCharged);
  const refunded = String(row?.paymentStatus || '').toLowerCase() === 'refunded';
  if (refunded && Number.isFinite(amount) && amount > 0) {
    return `This event is cancelled. ${formatMoney(amount)} is back in your wallet.`;
  }
  return 'This event is cancelled.';
}

function BookingPassCard({ booking, onBack }) {
  const eventName = booking.event?.eventName || `Event #${booking.eventId}`;
  const hostName = eventSpeakerNames(booking.event).join(', ');
  const place = booking.event?.place || '—';
  const eventDate = formatEventScheduleSummary(booking.event) || booking.event?.eventDate || '—';
  const cancelled = bookingCancelled(booking);
  const [qrImage, setQrImage] = useState('');
  const [shareNote, setShareNote] = useState('');
  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={onBack}
        className="text-sm font-semibold text-emerald-800 hover:underline"
      >
        ← Back to My Bookings
      </button>

      <article className="overflow-hidden rounded-[1.25rem] bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-800 shadow-[0_24px_60px_-20px_rgba(4,40,30,0.55)] ring-1 ring-[#c9a227]/55">
        <div className="h-1 bg-gradient-to-r from-[#8a7020] via-[#e8d48b] to-[#8a7020]" />

        <div className="px-5 py-5 text-white">
          <div className="flex items-stretch gap-3">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-[#e8d48b]">
                <Ticket className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Event ticket pass
              </p>
              <h3 className="mt-3 text-[1.7rem] font-semibold leading-[1.2] tracking-tight text-white">
                {eventName}
              </h3>
              {hostName ? (
                <p className="mt-2 text-[13px] font-medium text-emerald-50/85">
                  Speaker · {hostName}
                </p>
              ) : null}
            </div>
            <img
              src={wellnessValleyIcon}
              alt="Wellness Valley"
              className="h-16 w-16 shrink-0 self-center rounded-2xl bg-white object-contain p-1 shadow-sm app-logo"
            />
          </div>
        </div>

        <div className="bg-gradient-to-b from-emerald-50 to-white px-5 pb-6 pt-5">
          <div className="border-b border-emerald-200/80 pb-4">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-800">
              <User className="h-3.5 w-3.5" aria-hidden="true" />
              Guest
            </p>
            <p className="mt-2 text-[1.4rem] font-semibold leading-snug tracking-tight text-emerald-950">
              {booking.name || '—'}
            </p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                Date
              </p>
              <p className="mt-1.5 text-sm font-semibold tabular-nums text-emerald-950">{eventDate}</p>
            </div>
            <div>
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                Place
              </p>
              <p className="mt-1.5 text-sm font-semibold break-words text-emerald-950">{place}</p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <RegistrationQrCard
              qrPayload={booking.qrPayload}
              entryCode={booking.entryCode}
              eventName={eventName}
              compact
              onImageReady={setQrImage}
            />
            {cancelled ? null : (
              <>
                {shareNote ? (
                  <p className="text-sm text-emerald-950" role="status">{shareNote}</p>
                ) : null}
                <button
                  type="button"
                  disabled={!qrImage}
                  onClick={async () => {
                    setShareNote('');
                    const result = await shareTicketQrImage({
                      dataUrl: qrImage,
                      title: `${eventName} ticket`,
                      text: ticketShareCaption({
                        name: booking.name,
                        eventName,
                        entryCode: booking.entryCode,
                      }),
                      fileName: `event-ticket-${booking.entryCode || 'ticket'}.png`,
                    });
                    if (result.saved) {
                      setShareNote('The QR picture is saved. Open WhatsApp and attach that picture.');
                    } else if (result.ok) {
                      setShareNote('WhatsApp has the QR picture. Choose the chat and send. The ticket words are copied so you can paste them.');
                    } else {
                      setShareNote('The QR picture could not be attached. Try again.');
                    }
                  }}
                  className="w-full rounded-lg bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {qrImage ? 'Send QR on WhatsApp' : 'Preparing QR…'}
                </button>
              </>
            )}
          </div>
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
    <section aria-label="My Bookings" className="space-y-3">
      <div className="flex items-center gap-2">
        <Ticket className="h-5 w-5 text-emerald-800" aria-hidden="true" />
        <h2 className="text-lg font-bold text-gray-900">My Bookings</h2>
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
            const hostName = eventSpeakerNames(row.event).join(', ');
            const place = row.event?.place || '—';
            const eventDate = formatEventScheduleSummary(row.event) || row.event?.eventDate || '—';
            const checkedIn = Boolean(row.checkedInAt);
            const cancelled = bookingCancelled(row);
            const creditNote = bookingCreditNote(row);
            const locked = checkedIn || cancelled;
            const gradient = LIST_CARD_STYLES[index % LIST_CARD_STYLES.length];
            return (
              <li key={row.id}>
                <button
                  type="button"
                  disabled={locked}
                  aria-disabled={locked}
                  onClick={() => {
                    if (locked) return;
                    setSelected(row);
                  }}
                  className={`w-full overflow-hidden rounded-2xl border text-left shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
                    cancelled
                      ? 'cursor-default border-rose-200 bg-white'
                      : checkedIn
                        ? 'cursor-not-allowed border-gray-200 bg-gray-100 opacity-70 grayscale'
                        : 'border-emerald-100 bg-white transition hover:-translate-y-0.5 hover:shadow-lg'
                  }`}
                >
                  <div
                    className={`px-4 py-3.5 text-white ${
                      cancelled
                        ? 'bg-gradient-to-br from-rose-800 via-rose-700 to-rose-900'
                        : checkedIn
                          ? 'bg-gradient-to-br from-gray-500 via-gray-600 to-gray-700'
                          : `bg-gradient-to-br ${gradient}`
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/80">
                          My event booking
                        </p>
                        <p className="mt-1 truncate text-lg font-bold leading-tight">{eventName}</p>
                        {hostName ? (
                          <p className="mt-1 truncate text-xs text-white/90">Speaker · {hostName}</p>
                        ) : null}
                      </div>
                      <span className="shrink-0 rounded-full bg-white/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide">
                        {cancelled ? 'Cancelled' : checkedIn ? 'Checked in' : statusLabel(row.paymentStatus)}
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
                        {creditNote || `Paid ${formatMoney(row.amountCharged)}`}
                      </p>
                    </div>
                    {cancelled ? (
                      <span className="inline-flex items-center rounded-lg bg-rose-100 px-3 py-2 text-xs font-semibold text-rose-900">
                        Event cancelled
                      </span>
                    ) : checkedIn ? (
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
