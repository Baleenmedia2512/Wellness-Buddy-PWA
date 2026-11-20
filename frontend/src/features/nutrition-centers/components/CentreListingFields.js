import React, { useMemo } from 'react';
import AlarmTimePicker from '../../../shared/components/AlarmTimePicker';
import {
  CENTRE_FACILITIES,
  CENTRE_WEEKDAY_LABELS,
  CENTRE_WEEKDAYS,
  openingHoursToSimpleForm,
  simpleFormToOpeningHours,
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

function dayChip(active) {
  return `rounded-full border px-2.5 py-1.5 text-[12px] font-semibold transition ${
    active
      ? 'border-green-600 bg-green-600 text-white'
      : 'border-gray-300 bg-white text-gray-700'
  }`;
}

function toggleId(list, id, onChange) {
  const current = Array.isArray(list) ? list : [];
  onChange(current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
}

/**
 * Working days chips + one open/close (alarm wheels).
 * Persists the existing per-day openingHours JSON shape for the API.
 */
export default function CentreListingFields({
  hours,
  onHoursChange,
  facilities,
  onFacilitiesChange,
}) {
  const form = useMemo(() => openingHoursToSimpleForm(hours), [hours]);

  const patchForm = (patch) => {
    onHoursChange(simpleFormToOpeningHours({ ...form, ...patch }));
  };

  const toggleDay = (day) => {
    const has = form.workingDays.includes(day);
    patchForm({
      workingDays: has
        ? form.workingDays.filter((d) => d !== day)
        : [...form.workingDays, day],
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2.5 rounded-2xl border border-gray-200 bg-white px-3 py-3">
        <div>
          <p className="text-sm font-medium text-gray-700">
            Opening hours <span className="text-red-500">*</span>
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Choose working days, then set open and close once for all of them.
          </p>
        </div>

        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-gray-600">Working days</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {CENTRE_WEEKDAYS.map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => toggleDay(day)}
                className={dayChip(form.workingDays.includes(day))}
              >
                {CENTRE_WEEKDAY_LABELS[day].slice(0, 3)}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="mb-1 text-xs font-semibold text-gray-600">Opens</p>
            <AlarmTimePicker
              value={form.openingTime}
              title="Opening time"
              fallback=""
              onChange={(openingTime) => patchForm({ openingTime })}
              className="w-full rounded-xl border border-gray-300 bg-gray-50 px-3 py-2.5 text-left text-[13px] font-semibold text-gray-900"
            />
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold text-gray-600">Closes</p>
            <AlarmTimePicker
              value={form.closingTime}
              title="Closing time"
              fallback=""
              onChange={(closingTime) => patchForm({ closingTime })}
              className="w-full rounded-xl border border-gray-300 bg-gray-50 px-3 py-2.5 text-left text-[13px] font-semibold text-gray-900"
            />
          </div>
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
