/**
 * Working days chips + opens/closes via shared alarm-style time wheels.
 */
import React from 'react';
import { FieldLabel } from './formFields';
import { WEEK_DAYS } from '../domain/formOptions';
import AlarmTimePicker from '../../../shared/components/AlarmTimePicker';

function dayChip(active) {
  return `rounded-full border px-2.5 py-1.5 text-[12px] font-semibold transition ${
    active
      ? 'border-emerald-600 bg-emerald-600 text-white'
      : 'border-slate-200 bg-white text-slate-700'
  } disabled:opacity-50`;
}

/**
 * @param {{
 *   timings: { openingTime?: string, closingTime?: string, workingDays?: string[] },
 *   onChange: (patch: object) => void,
 *   disabled?: boolean,
 * }} props
 */
export default function HoursPicker({ timings = {}, onChange, disabled = false }) {
  const open = String(timings.openingTime || '').trim();
  const close = String(timings.closingTime || '').trim();
  const days = Array.isArray(timings.workingDays) ? timings.workingDays : [];

  const toggleDay = (day) => {
    if (disabled) return;
    if (days.includes(day)) onChange({ workingDays: days.filter((d) => d !== day) });
    else onChange({ workingDays: [...days, day] });
  };

  return (
    <div className="space-y-2.5 rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-600">Hours</p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <FieldLabel>Opens</FieldLabel>
          <AlarmTimePicker
            value={open}
            disabled={disabled}
            title="Opening time"
            fallback="09:00"
            onChange={(v) => onChange({ openingTime: v })}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-left text-[13px] font-semibold text-slate-900 disabled:opacity-60"
          />
        </div>
        <div>
          <FieldLabel>Closes</FieldLabel>
          <AlarmTimePicker
            value={close}
            disabled={disabled}
            title="Closing time"
            fallback="18:00"
            onChange={(v) => onChange({ closingTime: v })}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-left text-[13px] font-semibold text-slate-900 disabled:opacity-60"
          />
        </div>
      </div>

      <div>
        <FieldLabel>Working days</FieldLabel>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {WEEK_DAYS.map((day) => (
            <button
              key={day}
              type="button"
              disabled={disabled}
              onClick={() => toggleDay(day)}
              className={dayChip(days.includes(day))}
            >
              {day.slice(0, 3)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
