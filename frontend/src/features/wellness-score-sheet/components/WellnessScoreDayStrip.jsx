import React from 'react';
import { formatWellnessDayLabel } from '../domain/dateRange';

function barTone(pct) {
  if (pct >= 75) return 'bg-emerald-500';
  if (pct >= 50) return 'bg-amber-500';
  return 'bg-orange-400';
}

/**
 * Horizontal day selector when viewing a multi-day wellness score range.
 */
export default function WellnessScoreDayStrip({
  days = [],
  selectedDate,
  onSelectDate,
  today,
}) {
  if (!days.length || days.length <= 1) return null;

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-sm">
      <div className="border-b border-gray-100 bg-gray-50/80 px-4 py-2">
        <p className="text-xs font-bold uppercase tracking-wide text-gray-600">Select day</p>
      </div>
      <div className="flex gap-2 overflow-x-auto p-3 scrollbar-hide">
        {days.map((day) => {
          const active = day.date === selectedDate;
          const pct = Math.round(day.percentage ?? 0);
          return (
            <button
              key={day.date}
              type="button"
              onClick={() => onSelectDate(day.date)}
              className={`min-w-[88px] shrink-0 rounded-xl border p-2.5 text-left transition-all ${
                active
                  ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-200'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <p className={`text-[10px] font-semibold ${active ? 'text-emerald-800' : 'text-gray-500'}`}>
                {formatWellnessDayLabel(day.date, today)}
              </p>
              <p className={`mt-0.5 text-sm font-bold tabular-nums ${active ? 'text-gray-900' : 'text-gray-800'}`}>
                {Math.round(day.totalEarned ?? 0)}/{Math.round(day.totalPossible ?? 0)}
              </p>
              <p className="text-[10px] tabular-nums text-gray-500">{pct}%</p>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                <div className={`h-full rounded-full ${barTone(pct)}`} style={{ width: `${Math.min(100, pct)}%` }} />
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
