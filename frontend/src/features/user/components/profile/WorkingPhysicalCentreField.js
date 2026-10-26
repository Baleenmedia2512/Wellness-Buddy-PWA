/**
 * Profile dropdown under Community ID.
 * Shows this person's club. With no club, the nearest upline club.
 * None when nobody up the chain has a club.
 * Several clubs for that person are listed; the latest registration stays selected.
 */
import React, { useEffect, useState } from 'react';

const selectCls =
  'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none bg-white text-gray-800';

const WorkingPhysicalCentreField = ({ centre }) => {
  const options = Array.isArray(centre?.options) ? centre.options : [];
  const resolvedId = centre?.id != null ? String(centre.id) : '';
  const [selectedId, setSelectedId] = useState(resolvedId);

  useEffect(() => {
    setSelectedId(resolvedId);
  }, [resolvedId]);

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Working Physical Centre
      </label>
      <select
        value={options.length ? selectedId : ''}
        onChange={(e) => setSelectedId(e.target.value)}
        className={`${selectCls} ${options.length ? '' : 'text-gray-500'}`}
        style={{ fontSize: '16px' }}
      >
        {options.length === 0 ? (
          <option value="">None</option>
        ) : (
          options.map((opt) => (
            <option key={opt.id} value={String(opt.id)}>
              {opt.name}
            </option>
          ))
        )}
      </select>
      <p className="text-xs text-gray-500 mt-1">
        Your club. When you have no club, this uses the nearest upline club.
      </p>
    </div>
  );
};

export default WorkingPhysicalCentreField;
