/**
 * Profile dropdown under Community ID.
 * Shows this person's club. With no club, the nearest upline club.
 * None when nobody up the chain has a club.
 * Several clubs for that person are listed; the latest registration stays selected.
 *
 * Uses an in-page list (not the OS <select> popup) so options stay visible on mobile.
 */
import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { getCenters } from '../../../nutrition-centers/services/centers.api.js';

const triggerCls =
  'w-full flex min-h-11 touch-manipulation items-center justify-between gap-2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none bg-white text-left text-base';

function centreLabel(opt) {
  const text = String(opt?.name || opt?.center_name || '').trim();
  if (text) return text;
  const id = opt?.id;
  return id != null && String(id).trim() !== '' ? `Centre #${id}` : 'Centre';
}

function normalizeCentres(raw) {
  const data = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.data)
      ? raw.data
      : [];
  return data
    .map((opt) => {
      const id = opt?.id;
      if (id == null || String(id).trim() === '') return null;
      return { id: String(id), label: centreLabel(opt) };
    })
    .filter(Boolean);
}

const WorkingPhysicalCentreField = ({ userId, value, onChange }) => {
  const [options, setOptions] = useState([]);
  const [selectedId, setSelectedId] = useState(value ? String(value) : '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  // Reflect the value supplied by the parent (e.g. the saved profile centre).
  useEffect(() => {
    setSelectedId(value ? String(value) : '');
  }, [value]);

  // Load the available physical centres for the given user.
  useEffect(() => {
    let cancelled = false;

    if (!userId) {
      setOptions([]);
      setLoading(false);
      setError(null);
      return undefined;
    }

    setLoading(true);
    setError(null);

    getCenters({ userId, scope: 'all', metrics: 0, paginate: 0 })
      .then((raw) => {
        if (cancelled) return;
        setOptions(normalizeCentres(raw));
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message || 'Failed to load physical centres.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
    };
  }, [open]);

  const pick = (next) => {
    const id = next == null ? '' : String(next);
    setSelectedId(id);
    setOpen(false);
    if (onChange) onChange(id);
  };

  const selectedLabel =
    options.find((opt) => opt.id === selectedId)?.label
    || (selectedId ? `Centre #${selectedId}` : 'None');

  return (
    <div>
      <label
        htmlFor="working-physical-centre-trigger"
        className="block text-sm font-medium text-gray-700 mb-1"
      >
        Working Physical Centre
      </label>
      {loading ? (
        <p className="text-xs text-gray-500 mt-1">Loading centres...</p>
      ) : error ? (
        <p className="text-xs text-red-600 mt-1">{error}</p>
      ) : (
        <>
          <div ref={rootRef} className="relative w-full min-w-0 max-w-full">
            {/* Keep a hidden native select for form semantics / tests; not used for picking. */}
            <select
              id="working-physical-centre"
              name="workingPhysicalCentre"
              value={options.length ? selectedId : ''}
              onChange={(e) => pick(e.target.value)}
              className="pointer-events-none absolute h-0 w-0 opacity-0"
              tabIndex={-1}
              aria-hidden="true"
            >
              <option value="">None</option>
              {options.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              id="working-physical-centre-trigger"
              aria-haspopup="listbox"
              aria-expanded={open}
              aria-controls="working-physical-centre-listbox"
              onClick={() => setOpen((prev) => !prev)}
              className={`${triggerCls} ${selectedId ? 'text-gray-800' : 'text-gray-500'}`}
              style={{ fontSize: '16px' }}
            >
              <span className="min-w-0 flex-1 truncate">{selectedLabel}</span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
            </button>

            {open ? (
              <ul
                id="working-physical-centre-listbox"
                role="listbox"
                aria-labelledby="working-physical-centre-trigger"
                className="mt-1 max-h-52 w-full max-w-full overflow-y-auto overscroll-contain rounded-lg border border-gray-200 bg-white shadow-sm"
              >
                <li role="option" aria-selected={!selectedId}>
                  <button
                    type="button"
                    onClick={() => pick('')}
                    className={`flex min-h-11 w-full items-center px-3 py-2.5 text-left text-base ${
                      !selectedId
                        ? 'bg-green-50 font-semibold text-green-900'
                        : 'text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    None
                  </button>
                </li>
                {options.map((opt) => {
                  const on = selectedId === opt.id;
                  return (
                    <li key={opt.id} role="option" aria-selected={on}>
                      <button
                        type="button"
                        onClick={() => pick(opt.id)}
                        className={`flex min-h-11 w-full items-center px-3 py-2.5 text-left text-base ${
                          on
                            ? 'bg-green-50 font-semibold text-green-900'
                            : 'text-gray-800 hover:bg-gray-50'
                        }`}
                      >
                        <span className="truncate">{opt.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Your club. When you have no club, this uses the nearest upline club.
          </p>
        </>
      )}
    </div>
  );
};

export default WorkingPhysicalCentreField;
