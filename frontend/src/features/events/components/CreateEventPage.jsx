import React, { useCallback, useEffect, useState } from 'react';
import { Pencil, Trash2, X } from 'lucide-react';
import { getUserId } from '../../../shared/services/getUserId.js';
import {
  createEvent,
  deleteEvent,
  formatEventTimeRange,
  getEventDatesList,
  getEventPlacesList,
  eventSpeakerNames,
  listEvents,
  notifyEventsUpdated,
  updateEvent,
} from '../services/events.api.js';
import DesignatedPersonPicker from './DesignatedPersonPicker.jsx';
import EventCheckInPanel from './EventCheckInPanel.jsx';
import EventTicketReport from './EventTicketReport.jsx';
import HostPersonPicker from './HostPersonPicker.jsx';

const EMPTY_FORM = {
  eventName: '',
  speakers: [],
  places: [{ city: '', venue: '' }],
  eventDates: [{ date: '', startTime: '', endTime: '' }],
  ticketPrice: '',
  seatCount: '',
  designatedPersons: [],
};

function todayIstYmd() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function speakersFromEvent(item) {
  const names = eventSpeakerNames(item);
  const stored = Array.isArray(item?.speakers) ? item.speakers : [];
  return names.map((name) => {
    const match = stored.find((speaker) => String(speaker?.name || '').trim() === name);
    const userId = Number(match?.userId);
    return {
      name,
      userId: Number.isInteger(userId) && userId > 0 ? userId : null,
    };
  });
}

const STATUS_LABEL = {
  scheduled: 'Scheduled',
  postponed: 'Postponed',
  cancelled: 'Cancelled',
};

const inputClass = 'mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-base font-normal outline-none focus:border-green-600';

function statusClass(status) {
  if (status === 'postponed') return 'bg-amber-100 text-amber-900';
  if (status === 'cancelled') return 'bg-rose-100 text-rose-800';
  return 'bg-emerald-100 text-emerald-800';
}

function formatPrice(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return '';
  return `₹${value.toFixed(2)}`;
}

export default function CreateEventPage({ user, initialTab = 'manage' }) {
  const [userId, setUserId] = useState(null);
  const [ready, setReady] = useState(false);
  const [pageTab, setPageTab] = useState(initialTab === 'checkin' ? 'checkin' : 'manage');
  const [events, setEvents] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [whatsappChats, setWhatsappChats] = useState([]);
  const [actionModalEvent, setActionModalEvent] = useState(null);
  const [reportEvent, setReportEvent] = useState(null);

  useEffect(() => {
    setPageTab(initialTab === 'checkin' ? 'checkin' : 'manage');
  }, [initialTab]);

  useEffect(() => {
    let live = true;
    getUserId(user)
      .then((id) => {
        if (!live) return;
        const n = Number(id);
        setUserId(Number.isInteger(n) && n > 0 ? n : null);
      })
      .catch((err) => {
        if (live) setError(err?.message || 'Could not identify this account.');
      })
      .finally(() => {
        if (live) setReady(true);
      });
    return () => { live = false; };
  }, [user]);

  const loadEvents = useCallback(async (id) => {
    setLoading(true);
    setError('');
    try {
      const data = await listEvents(id);
      setEvents(Array.isArray(data.events) ? data.events : []);
      if (data?.notice) {
        setNotice(data.notice);
        setWhatsappChats(Array.isArray(data.whatsappChats) ? data.whatsappChats : []);
      }
    } catch (err) {
      setError(err?.message || 'Could not load events.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (userId) loadEvents(userId);
  }, [userId, loadEvents]);

  const onChange = (key) => (event) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }));
  };

  const updateDateEntry = (index, field, value) => {
    setForm((prev) => {
      const nextDates = [...prev.eventDates];
      nextDates[index] = { ...nextDates[index], [field]: value };
      return { ...prev, eventDates: nextDates };
    });
  };

  const addDateEntry = () => {
    setForm((prev) => ({
      ...prev,
      eventDates: [...prev.eventDates, { date: '', startTime: '', endTime: '' }],
    }));
  };

  const removeDateEntry = (index) => {
    setForm((prev) => {
      if (prev.eventDates.length <= 1) return prev;
      const nextDates = prev.eventDates.filter((_, i) => i !== index);
      return { ...prev, eventDates: nextDates };
    });
  };

  const updatePlaceEntry = (index, field, value) => {
    setForm((prev) => {
      const nextPlaces = [...prev.places];
      nextPlaces[index] = { ...nextPlaces[index], [field]: value };
      return { ...prev, places: nextPlaces };
    });
  };

  const addPlaceEntry = () => {
    setForm((prev) => ({
      ...prev,
      places: [...prev.places, { city: '', venue: '' }],
    }));
  };

  const removePlaceEntry = (index) => {
    setForm((prev) => {
      if (prev.places.length <= 1) return prev;
      const nextPlaces = prev.places.filter((_, i) => i !== index);
      return { ...prev, places: nextPlaces };
    });
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!userId) return;
    setSaving(true);
    setError('');
    const today = todayIstYmd();
    if ((form.speakers || []).length === 0) {
      setError('Add at least one speaker.');
      setSaving(false);
      return;
    }
    if ((form.eventDates || []).some((entry) => entry.date && entry.date < today)) {
      setError('Choose today or a later date.');
      setSaving(false);
      return;
    }
    const primaryDate = form.eventDates[0] || {};
    const primaryPlace = form.places[0] || {};
    const payload = {
      userId,
      ...form,
      place: primaryPlace.city || '',
      venue: primaryPlace.venue || '',
      eventDate: primaryDate.date || '',
      startTime: primaryDate.startTime || '',
      endTime: primaryDate.endTime || '',
      speakers: form.speakers,
      hostName: form.speakers.map((speaker) => speaker.name).join(' · '),
    };
    try {
      if (editingId) {
        await updateEvent({ ...payload, id: editingId });
      } else {
        await createEvent(payload);
      }
      notifyEventsUpdated();
      resetForm();
      await loadEvents(userId);
    } catch (err) {
      setError(err?.message || 'Could not save the event.');
    } finally {
      setSaving(false);
    }
  };

  const onEdit = (item) => {
    setEditingId(item.id);
    const existingDates = Array.isArray(item.eventDates) && item.eventDates.length > 0
      ? item.eventDates.map((d) => ({
          date: d.date || d.eventDate || '',
          startTime: d.startTime || '',
          endTime: d.endTime || '',
        }))
      : [{
          date: item.eventDate || '',
          startTime: item.startTime || '',
          endTime: item.endTime || '',
        }];

    const existingPlaces = Array.isArray(item.places) && item.places.length > 0
      ? item.places.map((p) => ({
          city: p.city || p.place || '',
          venue: p.venue || '',
        }))
      : [{
          city: item.place || item.city || '',
          venue: item.venue || '',
        }];

    setForm({
      eventName: item.eventName || '',
      speakers: speakersFromEvent(item),
      places: existingPlaces,
      eventDates: existingDates,
      ticketPrice: item.ticketPrice ?? '',
      seatCount: String(item.seatCount ?? ''),
      designatedPersons: Array.isArray(item.designatedPersons) ? item.designatedPersons : [],
    });
  };

  const onStatus = async (item, status) => {
    if (!userId) return;
    setSaving(true);
    setError('');
    try {
      const result = await updateEvent({ userId, id: item.id, status });
      notifyEventsUpdated();
      await loadEvents(userId);
      if (status === 'cancelled' && result?.notice) {
        setNotice(result.notice);
        setWhatsappChats(Array.isArray(result.whatsappChats) ? result.whatsappChats : []);
      }
    } catch (err) {
      setError(err?.message || 'Could not update the event.');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (item) => {
    if (!userId) return;
    const cancelled = String(item?.status || '').toLowerCase() === 'cancelled';
    if (!cancelled && (Number(item?.seatsTaken) > 0 || item?.hasBookings)) {
      const message = 'This event already has bookings, so it cannot be deleted. Cancel it first, then you can delete it.';
      setError(message);
      throw new Error(message);
    }
    setSaving(true);
    setError('');
    try {
      await deleteEvent({ userId, id: item.id });
      notifyEventsUpdated();
      if (editingId === item.id) resetForm();
      await loadEvents(userId);
    } catch (err) {
      setError(err?.message || 'Could not delete the event.');
      throw err;
    } finally {
      setSaving(false);
    }
  };

  if (pageTab === 'checkin') {
    return (
      <div className="max-w-lg mx-auto px-4 py-4 pb-10">
        <h1 className="text-xl font-extrabold text-green-800">Check-in</h1>
        <div className="mt-4">
          <EventCheckInPanel user={user} />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-4 pb-10">
      <h1 className="text-xl font-extrabold text-green-800">Create Event</h1>
      <p className="mt-1 text-sm text-gray-600">
        Add an event, then update, postpone, cancel, or delete it.
      </p>

      {!ready ? (
        <p className="mt-6 text-sm text-gray-500">Loading…</p>
      ) : !userId ? (
        <p className="mt-6 text-sm text-rose-700">Sign in to create events.</p>
      ) : (
        <>
          <form onSubmit={onSubmit} className="mt-4 space-y-3 rounded-2xl border border-green-100 bg-white p-4 shadow-sm">
            <h2 className="text-base font-bold text-gray-900">
              {editingId ? 'Update event' : 'New event'}
            </h2>
            <label className="block text-sm font-medium text-gray-700">
              Event name
              <input value={form.eventName} onChange={onChange('eventName')} maxLength={200} required className={inputClass} />
            </label>
            <HostPersonPicker
              userId={userId}
              speakers={form.speakers}
              onChange={(speakers) => setForm((prev) => ({ ...prev, speakers }))}
            />
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="block text-sm font-medium text-gray-700">
                  Places & Venues
                </span>
                <button
                  type="button"
                  onClick={addPlaceEntry}
                  className="rounded-lg border border-dashed border-green-600 bg-green-50 px-2.5 py-1 text-xs font-bold text-green-800 hover:bg-green-100"
                >
                  + Add place
                </button>
              </div>

              {form.places.map((entry, index) => (
                <div
                  key={index}
                  className="space-y-2 rounded-xl border border-gray-200 bg-gray-50/70 p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-700">
                      Place {form.places.length > 1 ? `#${index + 1}` : ''}
                    </span>
                    {form.places.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removePlaceEntry(index)}
                        className="text-xs font-semibold text-rose-600 hover:text-rose-800"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <label className="block text-xs font-medium text-gray-600">
                    City / Place *
                    <input
                      type="text"
                      placeholder="e.g. Madurai, Chennai"
                      value={entry.city}
                      onChange={(e) => updatePlaceEntry(index, 'city', e.target.value)}
                      maxLength={300}
                      required
                      className={inputClass}
                    />
                  </label>
                  <label className="block text-xs font-medium text-gray-600">
                    Venue (Optional — can add later)
                    <input
                      type="text"
                      placeholder="e.g. Hall name, Address (optional)"
                      value={entry.venue}
                      onChange={(e) => updatePlaceEntry(index, 'venue', e.target.value)}
                      maxLength={300}
                      className={inputClass}
                    />
                  </label>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="block text-sm font-medium text-gray-700">
                  Dates & Timing
                </span>
                <button
                  type="button"
                  onClick={addDateEntry}
                  className="rounded-lg border border-dashed border-green-600 bg-green-50 px-2.5 py-1 text-xs font-bold text-green-800 hover:bg-green-100"
                >
                  + Add date
                </button>
              </div>

              {form.eventDates.map((entry, index) => (
                <div
                  key={index}
                  className="space-y-2 rounded-xl border border-gray-200 bg-gray-50/70 p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-700">
                      Date {form.eventDates.length > 1 ? `#${index + 1}` : ''}
                    </span>
                    {form.eventDates.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeDateEntry(index)}
                        className="text-xs font-semibold text-rose-600 hover:text-rose-800"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <label className="block text-xs font-medium text-gray-600">
                    Date
                    <input
                      type="date"
                      value={entry.date}
                      min={todayIstYmd()}
                      onChange={(e) => {
                        const next = e.target.value;
                        if (next && next < todayIstYmd()) {
                          setError('Choose today or a later date.');
                          return;
                        }
                        setError('');
                        updateDateEntry(index, 'date', next);
                      }}
                      required
                      className={inputClass}
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block text-xs font-medium text-gray-600">
                      Start time
                      <input
                        type="time"
                        value={entry.startTime}
                        onChange={(e) => updateDateEntry(index, 'startTime', e.target.value)}
                        className={inputClass}
                      />
                    </label>
                    <label className="block text-xs font-medium text-gray-600">
                      End time
                      <input
                        type="time"
                        value={entry.endTime}
                        onChange={(e) => updateDateEntry(index, 'endTime', e.target.value)}
                        className={inputClass}
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
            <label className="block text-sm font-medium text-gray-700">
              Ticket price
              <input value={form.ticketPrice} onChange={onChange('ticketPrice')} inputMode="decimal" min={0} required className={inputClass} />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              No of seats
              <input value={form.seatCount} onChange={onChange('seatCount')} inputMode="numeric" min={1} required className={inputClass} />
            </label>
            <DesignatedPersonPicker
              userId={userId}
              userEmail={user?.email || user?.Email || ''}
              selected={form.designatedPersons}
              onChange={(designatedPersons) => setForm((prev) => ({ ...prev, designatedPersons }))}
            />
            {error ? <p className="text-sm text-rose-700">{error}</p> : null}
            {notice ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950" role="status">
                <p>{notice}</p>
                {whatsappChats.length > 0 ? (
                  <div className="mt-2 flex flex-col gap-1">
                    {whatsappChats.map((chat) => (
                      <a
                        key={chat.url}
                        href={chat.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-emerald-800 underline"
                      >
                        Send WhatsApp to {chat.name}
                      </a>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 rounded-xl bg-green-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
              >
                {saving ? 'Saving…' : editingId ? 'Update' : 'Create'}
              </button>
              {editingId ? (
                <button type="button" onClick={resetForm} className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700">
                  Clear
                </button>
              ) : null}
            </div>
          </form>

          <section className="mt-6">
            <h2 className="text-base font-bold text-gray-900">Your events</h2>
            {loading ? <p className="mt-3 text-sm text-gray-500">Loading events…</p> : null}
            {!loading && events.length === 0 ? (
              <p className="mt-3 text-sm text-gray-500">No events yet.</p>
            ) : null}
            <ul className="mt-3 space-y-3">
              {events.map((item) => (
                <li key={item.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-gray-900">{item.eventName}</p>
                      <p className="text-sm text-gray-600">
                        {eventSpeakerNames(item).length > 1 ? 'Speakers' : 'Speaker'}
                        {': '}
                        {eventSpeakerNames(item).join(', ') || '—'}
                      </p>
                      <div className="text-sm text-gray-600">
                        {getEventPlacesList(item).length > 1 ? (
                          <div className="space-y-0.5">
                            <span className="font-semibold text-gray-700">Places ({getEventPlacesList(item).length}):</span>
                            {getEventPlacesList(item).map((p, pIdx) => (
                              <p key={pIdx} className="text-xs text-gray-600">
                                • {p.city}{p.venue ? ` · ${p.venue}` : ''}
                              </p>
                            ))}
                          </div>
                        ) : (
                          <p>
                            {[item.place || item.city, item.venue].filter(Boolean).join(' · ') || '—'}
                          </p>
                        )}
                      </div>
                      <div className="text-sm text-gray-600">
                        {getEventDatesList(item).length > 1 ? (
                          <div className="space-y-0.5">
                            <span className="font-semibold text-gray-700">Dates ({getEventDatesList(item).length}):</span>
                            {getEventDatesList(item).map((d, dIdx) => (
                              <p key={dIdx} className="text-xs text-gray-600">
                                • {d.date}
                                {formatEventTimeRange(d.startTime, d.endTime)
                                  ? ` · ${formatEventTimeRange(d.startTime, d.endTime)}`
                                  : ''}
                              </p>
                            ))}
                          </div>
                        ) : (
                          <p>
                            {item.eventDate}
                            {formatEventTimeRange(item.startTime, item.endTime)
                              ? ` · ${formatEventTimeRange(item.startTime, item.endTime)}`
                              : ''}
                          </p>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">{formatPrice(item.ticketPrice)} · {item.seatCount} seats</p>
                      <p className="text-sm text-gray-600">
                        {(item.designatedPersons || []).map((person) => person.name).join(', ')}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${statusClass(item.status)}`}>
                      {STATUS_LABEL[item.status] || item.status}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-end gap-2 border-t border-gray-100 pt-2.5">
                    <button
                      type="button"
                      onClick={() => setReportEvent(item)}
                      className="mr-auto rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 text-xs font-bold text-emerald-900"
                    >
                      Report
                    </button>
                    <button
                      type="button"
                      onClick={() => onEdit(item)}
                      aria-label="Edit event"
                      title="Edit event"
                      className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white p-2 text-gray-700 shadow-sm transition hover:bg-gray-50 hover:text-green-800 focus:outline-none focus:ring-2 focus:ring-green-600"
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setActionModalEvent(item)}
                      aria-label="Delete or cancel event"
                      title="Delete or cancel event"
                      className="inline-flex items-center justify-center rounded-lg border border-rose-200 bg-white p-2 text-rose-600 shadow-sm transition hover:bg-rose-50 hover:text-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-600"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      {actionModalEvent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget && !saving) setActionModalEvent(null);
          }}
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-base font-bold text-gray-900">
                {String(actionModalEvent.status || '').toLowerCase() === 'cancelled'
                  ? 'Delete Event'
                  : 'Cancel or Delete Event'}
              </h3>
              <button
                type="button"
                onClick={() => setActionModalEvent(null)}
                disabled={saving}
                className="rounded-full bg-gray-100 p-1.5 text-gray-750 transition hover:bg-gray-200 hover:text-gray-950 focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-50"
                aria-label="Close"
              >
                <X className="h-5 w-5 stroke-[2.25]" />
              </button>
            </div>

            <p className="mt-2 text-sm text-gray-600">
              {String(actionModalEvent.status || '').toLowerCase() === 'cancelled'
                ? 'This event is cancelled. You can delete it from your list. People who booked still see that it was cancelled.'
                : actionModalEvent.hasBookings || Number(actionModalEvent.seatsTaken) > 0
                ? 'People have already booked this event. Cancelling returns their ticket credit and emails them. After it is cancelled, you can delete it.'
                : (
                  <>
                    What would you like to do with{' '}
                    <span className="font-semibold text-gray-900">
                      &ldquo;{actionModalEvent.eventName}&rdquo;
                    </span>
                    ?
                  </>
                )}
            </p>

            {error ? (
              <p className="mt-2 text-xs text-rose-600">{error}</p>
            ) : null}

            <div className="mt-5 space-y-2">
              {String(actionModalEvent.status || '').toLowerCase() === 'cancelled' ? null : (
                <button
                  type="button"
                  disabled={saving}
                  onClick={async () => {
                    try {
                      await onStatus(actionModalEvent, 'cancelled');
                      setActionModalEvent(null);
                    } catch {
                      // error handled in onStatus
                    }
                  }}
                  className="w-full rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-center text-sm font-bold text-amber-900 hover:bg-amber-100 disabled:opacity-60"
                >
                  {saving ? 'Processing…' : 'Cancel Event'}
                </button>
              )}

              <button
                type="button"
                disabled={saving || (String(actionModalEvent.status || '').toLowerCase() !== 'cancelled' && (actionModalEvent.hasBookings || Number(actionModalEvent.seatsTaken) > 0))}
                onClick={async () => {
                  try {
                    await onDelete(actionModalEvent);
                    setActionModalEvent(null);
                  } catch {
                    // error stays in this dialog
                  }
                }}
                className="w-full rounded-xl bg-rose-600 px-4 py-2.5 text-center text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-60"
              >
                {saving
                  ? 'Processing…'
                  : (String(actionModalEvent.status || '').toLowerCase() !== 'cancelled' && (actionModalEvent.hasBookings || Number(actionModalEvent.seatsTaken) > 0))
                    ? 'Delete unavailable'
                    : 'Delete Event'}
              </button>
            </div>
          </div>
        </div>
      )}
      {reportEvent ? (
        <EventTicketReport
          user={user}
          eventId={reportEvent.id}
          eventName={reportEvent.eventName}
          onClose={() => setReportEvent(null)}
        />
      ) : null}
    </div>
  );
}
