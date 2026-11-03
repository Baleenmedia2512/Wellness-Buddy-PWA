import React, { useCallback, useEffect, useState } from 'react';
import { getUserId } from '../../../shared/services/getUserId.js';
import {
  createEvent,
  deleteEvent,
  listEvents,
  notifyEventsUpdated,
  updateEvent,
} from '../services/events.api.js';
import DesignatedPersonPicker from './DesignatedPersonPicker.jsx';
import EventCheckInPanel from './EventCheckInPanel.jsx';
import HostPersonPicker from './HostPersonPicker.jsx';

const EMPTY_FORM = {
  eventName: '',
  hostName: '',
  place: '',
  eventDate: '',
  ticketPrice: '',
  seatCount: '',
  designatedPersons: [],
};

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
  const [pendingDeleteId, setPendingDeleteId] = useState(null);

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

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!userId) return;
    setSaving(true);
    setError('');
    const payload = { userId, ...form };
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
    setPendingDeleteId(null);
    setForm({
      eventName: item.eventName || '',
      hostName: item.hostName || '',
      place: item.place || '',
      eventDate: item.eventDate || '',
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
      await updateEvent({ userId, id: item.id, status });
      notifyEventsUpdated();
      await loadEvents(userId);
    } catch (err) {
      setError(err?.message || 'Could not update the event.');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (item) => {
    if (!userId) return;
    setSaving(true);
    setError('');
    try {
      await deleteEvent({ userId, id: item.id });
      notifyEventsUpdated();
      if (editingId === item.id) resetForm();
      setPendingDeleteId(null);
      await loadEvents(userId);
    } catch (err) {
      setError(err?.message || 'Could not delete the event.');
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
              value={form.hostName}
              onChange={(hostName) => setForm((prev) => ({ ...prev, hostName }))}
            />
            <label className="block text-sm font-medium text-gray-700">
              Place
              <input value={form.place} onChange={onChange('place')} maxLength={300} required className={inputClass} />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Date
              <input type="date" value={form.eventDate} onChange={onChange('eventDate')} required className={inputClass} />
            </label>
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
                      <p className="text-sm text-gray-600">Host: {item.hostName}</p>
                      <p className="text-sm text-gray-600">{item.place}</p>
                      <p className="text-sm text-gray-600">{item.eventDate}</p>
                      <p className="text-sm text-gray-600">{formatPrice(item.ticketPrice)} · {item.seatCount} seats</p>
                      <p className="text-sm text-gray-600">
                        {(item.designatedPersons || []).map((person) => person.name).join(', ')}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${statusClass(item.status)}`}>
                      {STATUS_LABEL[item.status] || item.status}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => onEdit(item)} className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-800">Edit</button>
                    {item.status !== 'postponed' ? (
                      <button type="button" disabled={saving} onClick={() => onStatus(item, 'postponed')} className="rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-900">Postpone</button>
                    ) : null}
                    {item.status !== 'cancelled' ? (
                      <button type="button" disabled={saving} onClick={() => onStatus(item, 'cancelled')} className="rounded-lg bg-rose-100 px-3 py-1.5 text-xs font-semibold text-rose-800">Cancel</button>
                    ) : null}
                    {item.status !== 'scheduled' ? (
                      <button type="button" disabled={saving} onClick={() => onStatus(item, 'scheduled')} className="rounded-lg bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-800">Scheduled</button>
                    ) : null}
                    {pendingDeleteId === item.id ? (
                      <>
                        <button type="button" disabled={saving} onClick={() => onDelete(item)} className="rounded-lg bg-rose-700 px-3 py-1.5 text-xs font-semibold text-white">Confirm delete</button>
                        <button type="button" onClick={() => setPendingDeleteId(null)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700">Keep</button>
                      </>
                    ) : (
                      <button type="button" onClick={() => setPendingDeleteId(item.id)} className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700">Delete</button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
