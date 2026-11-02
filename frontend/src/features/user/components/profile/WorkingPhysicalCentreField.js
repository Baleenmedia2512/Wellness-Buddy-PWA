/**
 * Profile dropdown under Community ID.
 * Shows this person's club. With no club, the nearest upline club.
 * None when nobody up the chain has a club.
 * Several clubs for that person are listed; the latest registration stays selected.
 */
import React, { useEffect, useState } from 'react';
import { getCenters } from '../../../nutrition-centers/services/centers.api.js';

const selectCls =
  'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none bg-white text-gray-800';

const WorkingPhysicalCentreField = ({ userId, value, onChange }) => {
  const [options, setOptions] = useState([]);
  const [selectedId, setSelectedId] = useState(value || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Reflect the value supplied by the parent (e.g. the saved profile centre).
  useEffect(() => {
    setSelectedId(value || '');
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
        const data = Array.isArray(raw)
          ? raw
          : Array.isArray(raw?.data)
            ? raw.data
            : [];
        setOptions(data);
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

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Working Physical Centre
      </label>
      {loading ? (
        <p className="text-xs text-gray-500 mt-1">Loading centres...</p>
      ) : error ? (
        <p className="text-xs text-red-600 mt-1">{error}</p>
      ) : (
        <>
          <select
            value={options.length ? selectedId : ''}
            onChange={(e) => {
              const next = e.target.value;
              setSelectedId(next);
              if (onChange) onChange(next);
            }}
            className={`${selectCls} ${options.length ? '' : 'text-gray-500'}`}
            style={{ fontSize: '16px' }}
          >
            <option value="">None</option>
            {options.map((opt) => (
              <option key={opt.id} value={String(opt.id)}>
                {opt.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Your club. When you have no club, this uses the nearest upline club.
          </p>
        </>
      )}
    </div>
  );
};

export default WorkingPhysicalCentreField;
