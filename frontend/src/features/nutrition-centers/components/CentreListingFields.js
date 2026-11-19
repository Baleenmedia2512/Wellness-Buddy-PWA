import React from 'react';
import {
  CENTRE_FACILITIES,
  CENTRE_WEEKDAY_LABELS,
  CENTRE_WEEKDAYS,
} from '../domain/centreListing.rules.js';

function Chip({ active, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
        active
          ? 'border-green-600 bg-green-600 text-white'
          : 'border-gray-300 bg-white text-gray-700'
      }`}
    >
      {label}
    </button>
  );
}

function toggleId(list, id, onChange) {
  const current = Array.isArray(list) ? list : [];
  onChange(current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
}

/**
 * Monday-to-Sunday hours and facility chips.
 */
export default function CentreListingFields({
  hours,
  onHoursChange,
  facilities,
  onFacilitiesChange,
}) {
  const patchDay = (day, patch) => {
    const current = hours?.[day] || { closed: false, slots: [] };
    onHoursChange({
      ...hours,
      [day]: { ...current, ...patch },
    });
  };

  const setSlot = (day, index, field, value) => {
    const slots = (hours?.[day]?.slots || []).map((slot, slotIndex) => (
      slotIndex === index ? { ...slot, [field]: value } : slot
    ));
    patchDay(day, { slots });
  };

  const setClosed = (day, closed) => {
    const current = hours?.[day] || { closed: false, slots: [] };
    if (closed) {
      patchDay(day, { closed: true });
      return;
    }
    const slots = current.slots?.length ? current.slots : [{ open: '05:30', close: '13:00' }];
    patchDay(day, { closed: false, slots });
  };

  const addSlot = (day) => {
    const slots = hours?.[day]?.slots || [];
    if (slots.length >= 2) return;
    patchDay(day, { closed: false, slots: [...slots, { open: '17:00', close: '21:30' }] });
  };

  const removeSlot = (day) => {
    const slots = hours?.[day]?.slots || [];
    patchDay(day, { slots: slots.slice(0, 1) });
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-gray-700">
          Opening hours <span className="text-red-500">*</span>
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Monday to Sunday. A day can have two open-to-close times, or be closed.
        </p>
        <div className="mt-3 divide-y divide-gray-100 rounded-lg border border-gray-200">
          {CENTRE_WEEKDAYS.map((day) => {
            const entry = hours?.[day] || { closed: false, slots: [] };
            return (
              <div key={day} className="px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-gray-800">{CENTRE_WEEKDAY_LABELS[day]}</span>
                  <button
                    type="button"
                    onClick={() => setClosed(day, !entry.closed)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      entry.closed ? 'bg-gray-200 text-gray-600' : 'bg-green-100 text-green-700'
                    }`}
                  >
                    {entry.closed ? 'Closed' : 'Open'}
                  </button>
                </div>
                {!entry.closed && (
                  <div className="mt-2 space-y-2">
                    {(entry.slots || []).map((slot, index) => (
                      <div key={`${day}-${index}`} className="flex items-center gap-2">
                        <input
                          type="time"
                          value={slot.open || ''}
                          onChange={(event) => setSlot(day, index, 'open', event.target.value)}
                          className="flex-1 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                          aria-label={`${CENTRE_WEEKDAY_LABELS[day]} open ${index + 1}`}
                          required
                        />
                        <span className="text-xs text-gray-400">to</span>
                        <input
                          type="time"
                          value={slot.close || ''}
                          onChange={(event) => setSlot(day, index, 'close', event.target.value)}
                          className="flex-1 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                          aria-label={`${CENTRE_WEEKDAY_LABELS[day]} close ${index + 1}`}
                          required
                        />
                      </div>
                    ))}
                    <div className="flex gap-3">
                      {(entry.slots || []).length < 2 && (
                        <button type="button" onClick={() => addSlot(day)} className="text-xs font-medium text-green-700">
                          Add hours
                        </button>
                      )}
                      {(entry.slots || []).length > 1 && (
                        <button type="button" onClick={() => removeSlot(day)} className="text-xs font-medium text-gray-500">
                          Remove second slot
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">
          Facilities available <span className="text-red-500">*</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {CENTRE_FACILITIES.map((item) => (
            <Chip
              key={item.id}
              label={item.label}
              active={(facilities || []).includes(item.id)}
              onClick={() => toggleId(facilities, item.id, onFacilitiesChange)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
