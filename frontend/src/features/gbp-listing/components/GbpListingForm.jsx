import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';
import {
  emptyGbpForm,
  GBP_CATEGORIES,
  WEEKDAYS,
} from '../domain/gbp.rules';
import {
  fetchGbpCenterPlace,
  saveGbpDraft,
  submitGbpRequest,
  uploadGbpMedia,
} from '../services/gbpApi';

function Field({ label, children }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-gray-600">{label}</span>
      {children}
    </label>
  );
}

const inputClass = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-emerald-400';

/**
 * GBP request form — fields mirror Google Business Profile create.
 */
export default function GbpListingForm({
  userId,
  centerId: initialCenterId,
  centerName: initialCenterName,
  createMode,
  availableCenters = [],
  initialRequest = null,
  categories = GBP_CATEGORIES,
  phoneHint = '',
  onClose,
}) {
  const centers = useMemo(() => {
    const list = Array.isArray(availableCenters) ? availableCenters : [];
    if (!createMode) return list;
    // New request: only centers without an in-flight / live row (or editable draft/needs_info).
    return list.filter((c) => {
      const st = String(c?.request?.status || '');
      if (!c?.hasRequest) return true;
      return st === 'draft' || st === 'needs_info';
    });
  }, [availableCenters, createMode]);

  const [centerId, setCenterId] = useState(
    initialCenterId != null ? String(initialCenterId) : '',
  );
  const [form, setForm] = useState(() => {
    if (initialRequest) {
      return {
        ...emptyGbpForm(),
        businessName: initialRequest.businessName || '',
        primaryCategory: initialRequest.primaryCategory || '',
        streetAddress: initialRequest.streetAddress || '',
        landmark: initialRequest.landmark || '',
        area: initialRequest.area || '',
        city: initialRequest.city || '',
        state: initialRequest.state || 'Tamil Nadu',
        pincode: initialRequest.pincode || '',
        showAddress: initialRequest.showAddress !== false,
        phone: initialRequest.phone || phoneHint || '',
        whatsapp: initialRequest.whatsapp || '',
        websiteUrl: initialRequest.websiteUrl || '',
        workingDays: Array.isArray(initialRequest.workingDays) && initialRequest.workingDays.length
          ? initialRequest.workingDays
          : emptyGbpForm().workingDays,
        openingTime: initialRequest.openingTime || '07:00',
        closingTime: initialRequest.closingTime || '19:00',
        weeklyHoliday: initialRequest.weeklyHoliday || 'Sunday',
        description: initialRequest.description || '',
      };
    }
    const empty = emptyGbpForm();
    if (phoneHint) empty.phone = phoneHint;
    if (initialCenterName) empty.businessName = initialCenterName;
    return empty;
  });
  const [request, setRequest] = useState(initialRequest);
  const [busy, setBusy] = useState(false);
  const [placeLoading, setPlaceLoading] = useState(false);
  const [message, setMessage] = useState('');
  const autoPlaceOnce = useRef(false);

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const applyCenterPlace = async (nextCenterId, { forceName = false, fillEmptyOnly = false } = {}) => {
    const cid = Number(nextCenterId);
    if (!Number.isFinite(cid) || cid <= 0 || userId == null) return;
    setPlaceLoading(true);
    setMessage('');
    try {
      const place = await fetchGbpCenterPlace({ userId, centerId: cid });
      setForm((prev) => {
        const pick = (next, cur) => {
          if (fillEmptyOnly && String(cur || '').trim()) return cur;
          return next || cur;
        };
        return {
          ...prev,
          businessName: forceName || !String(prev.businessName || '').trim()
            ? (place.businessName || place.centerName || prev.businessName)
            : prev.businessName,
          streetAddress: pick(place.streetAddress, prev.streetAddress),
          landmark: pick(place.landmark, prev.landmark),
          area: pick(place.area, prev.area),
          city: pick(place.city, prev.city),
          state: pick(place.state, prev.state) || 'Tamil Nadu',
          pincode: pick(place.pincode, prev.pincode),
          phone: pick(place.phoneHint, prev.phone) || phoneHint || prev.phone,
        };
      });
      setMessage('Address loaded from center GPS');
    } catch (err) {
      setMessage(err?.message || 'Could not load center address');
    } finally {
      setPlaceLoading(false);
    }
  };

  // Edit / reopen: if address fields empty, pull exact place once from center GPS.
  useEffect(() => {
    if (autoPlaceOnce.current) return;
    const cid = Number(centerId || initialCenterId);
    if (!Number.isFinite(cid) || cid <= 0) return;
    const needsPlace = !String(form.streetAddress || '').trim()
      || !String(form.city || '').trim()
      || !String(form.area || '').trim();
    if (!needsPlace) return;
    autoPlaceOnce.current = true;
    applyCenterPlace(cid, { fillEmptyOnly: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot on open
  }, [centerId, initialCenterId]);

  const toggleDay = (day) => {
    setForm((prev) => {
      const has = prev.workingDays.includes(day);
      return {
        ...prev,
        workingDays: has
          ? prev.workingDays.filter((d) => d !== day)
          : [...prev.workingDays, day],
      };
    });
  };

  const onSaveDraft = async () => {
    const cid = Number(centerId);
    if (!Number.isFinite(cid) || cid <= 0) {
      setMessage('Select a center you own');
      return null;
    }
    setBusy(true);
    setMessage('');
    try {
      const data = await saveGbpDraft({
        userId,
        centerId: cid,
        fields: form,
      });
      setRequest(data);
      setMessage('Draft saved');
      return data;
    } catch (err) {
      setMessage(err?.message || 'Could not save draft');
      return null;
    } finally {
      setBusy(false);
    }
  };

  const onPickFiles = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;

    let current = request;
    if (!current?.id) {
      current = await onSaveDraft();
      if (!current?.id) return;
    }

    setBusy(true);
    setMessage('');
    try {
      let latest = current;
      for (const file of files) {
        const data = await uploadGbpMedia({
          userId,
          requestId: latest.id,
          file,
        });
        latest = data.request || latest;
      }
      setRequest(latest);
      setMessage(`Uploaded. ${latest.photoCount || 0} photos on file.`);
    } catch (err) {
      setMessage(err?.message || 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = async () => {
    let current = request;
    if (!current?.id) {
      current = await onSaveDraft();
      if (!current?.id) return;
    } else {
      const saved = await onSaveDraft();
      if (saved?.id) current = saved;
    }
    setBusy(true);
    setMessage('');
    try {
      await submitGbpRequest({ userId, requestId: current.id });
      onClose({ message: 'Submitted — our team will create your Map Business on Google Maps.' });
    } catch (err) {
      setMessage(err?.message || 'Submit failed');
    } finally {
      setBusy(false);
    }
  };

  const categoryOptions = categories.length ? categories : GBP_CATEGORIES;
  const mediaFiles = Array.isArray(request?.mediaFiles) ? request.mediaFiles : [];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#f4f7f5]">
      <header className="sticky top-0 z-10 border-b border-gray-200/80 bg-white/95 backdrop-blur safe-top">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          <TouchFeedbackButton
            onClick={() => onClose()}
            ariaLabel="Go back"
            className="-ml-2 rounded-lg p-2 hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5 text-gray-700" />
          </TouchFeedbackButton>
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-bold text-gray-900">
              {createMode ? 'New Google Map Business' : 'Edit Google Map Business'}
            </h1>
            <p className="text-xs text-gray-500">Details Google asks for a Maps business</p>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-lg flex-1 space-y-4 overflow-y-auto px-4 py-5 pb-28">
        {message ? (
          <p className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
            {message}
          </p>
        ) : null}

        <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-gray-900">Business</h2>
          <Field label="Center you own">
            <select
              className={inputClass}
              value={centerId}
              disabled={(!createMode && Boolean(initialCenterId)) || placeLoading || busy}
              onChange={(e) => {
                const id = e.target.value;
                setCenterId(id);
                const match = centers.find((c) => String(c.centerId) === id);
                if (match?.centerName) {
                  setField('businessName', match.centerName);
                }
                if (id) {
                  applyCenterPlace(id, { forceName: true });
                }
              }}
            >
              <option value="">Select center</option>
              {centers.map((c) => (
                <option key={c.centerId} value={c.centerId}>
                  {c.centerName || `Center ${c.centerId}`}
                </option>
              ))}
            </select>
            {placeLoading ? (
              <p className="mt-1 text-xs text-emerald-700">Fetching exact address from GPS…</p>
            ) : null}
          </Field>
          <Field label="Business name (as on board)">
            <input
              className={inputClass}
              value={form.businessName}
              onChange={(e) => setField('businessName', e.target.value)}
              maxLength={160}
            />
          </Field>
          <Field label="Primary category">
            <select
              className={inputClass}
              value={form.primaryCategory}
              onChange={(e) => setField('primaryCategory', e.target.value)}
            >
              <option value="">Select category</option>
              {categoryOptions.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Short description (max 500)">
            <textarea
              className={`${inputClass} min-h-[88px]`}
              value={form.description}
              onChange={(e) => setField('description', e.target.value.slice(0, 500))}
              maxLength={500}
            />
          </Field>
        </section>

        <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-gray-900">Address</h2>
          <Field label="Street address">
            <input className={inputClass} value={form.streetAddress} onChange={(e) => setField('streetAddress', e.target.value)} />
          </Field>
          <Field label="Landmark (optional)">
            <input className={inputClass} value={form.landmark} onChange={(e) => setField('landmark', e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Area / locality">
              <input className={inputClass} value={form.area} onChange={(e) => setField('area', e.target.value)} />
            </Field>
            <Field label="City">
              <input className={inputClass} value={form.city} onChange={(e) => setField('city', e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="State">
              <input className={inputClass} value={form.state} onChange={(e) => setField('state', e.target.value)} />
            </Field>
            <Field label="PIN code">
              <input className={inputClass} value={form.pincode} onChange={(e) => setField('pincode', e.target.value)} />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.showAddress}
              onChange={(e) => setField('showAddress', e.target.checked)}
            />
            Show address on Google Maps
          </label>
        </section>

        <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-gray-900">Contact &amp; hours</h2>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone">
              <input className={inputClass} value={form.phone} onChange={(e) => setField('phone', e.target.value)} inputMode="tel" />
            </Field>
            <Field label="WhatsApp (optional)">
              <input className={inputClass} value={form.whatsapp} onChange={(e) => setField('whatsapp', e.target.value)} inputMode="tel" />
            </Field>
          </div>
          <Field label="Website (Digital Portfolio URL if ready)">
            <input className={inputClass} value={form.websiteUrl} onChange={(e) => setField('websiteUrl', e.target.value)} />
          </Field>
          <div>
            <p className="mb-2 text-xs font-medium text-gray-600">Working days</p>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((day) => {
                const on = form.workingDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      on ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {day.slice(0, 3)}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Opening time">
              <input type="time" className={inputClass} value={form.openingTime} onChange={(e) => setField('openingTime', e.target.value)} />
            </Field>
            <Field label="Closing time">
              <input type="time" className={inputClass} value={form.closingTime} onChange={(e) => setField('closingTime', e.target.value)} />
            </Field>
          </div>
          <Field label="Weekly holiday">
            <input className={inputClass} value={form.weeklyHoliday} onChange={(e) => setField('weeklyHoliday', e.target.value)} />
          </Field>
        </section>

        <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-gray-900">Photos &amp; videos</h2>
          <p className="text-xs text-gray-500">
            Upload at least 3 photos: name board, entrance/exterior, interior. Video optional.
          </p>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
            multiple
            onChange={onPickFiles}
            disabled={busy}
            className="block w-full text-sm text-gray-600"
          />
          {mediaFiles.length ? (
            <ul className="space-y-1 text-xs text-gray-600">
              {mediaFiles.map((f) => (
                <li key={f.key} className="truncate">
                  {f.kind === 'video' ? 'Video' : 'Photo'}
                  {f.originalName ? ` — ${f.originalName}` : ''}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-gray-400">No media uploaded yet</p>
          )}
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur safe-bottom">
        <div className="mx-auto flex max-w-lg gap-2">
          <TouchFeedbackButton
            type="button"
            disabled={busy}
            onClick={onSaveDraft}
            className="flex-1 rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm font-semibold text-emerald-800"
          >
            Save draft
          </TouchFeedbackButton>
          <TouchFeedbackButton
            type="button"
            disabled={busy}
            onClick={onSubmit}
            className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white"
          >
            Submit
          </TouchFeedbackButton>
        </div>
      </div>
    </div>
  );
}
