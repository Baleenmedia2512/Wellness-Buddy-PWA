import React, { useMemo } from 'react';
import { formatWellnessDayLabel } from '../domain/dateRange';
import { getParameterMeta } from '../domain/parameterRegistry';

/**
 * Multi-day grid: each parameter shows earned / maxPoints per day.
 */
export default function WellnessScoreParameterHistory({ days = [], today, selectedDate }) {
  const rows = useMemo(() => {
    if (!days.length) return [];

    const keyOrder = [];
    const keySet = new Set();
    for (const day of days) {
      for (const param of day.parameters || []) {
        if (!keySet.has(param.key)) {
          keySet.add(param.key);
          keyOrder.push(param.key);
        }
      }
    }

    return keyOrder.map((key) => {
      const meta = getParameterMeta(key);
      const byDate = {};
      for (const day of days) {
        const param = (day.parameters || []).find((p) => p.key === key);
        byDate[day.date] = param
          ? { earned: param.earnedPoints ?? 0, max: param.maxPoints ?? 0 }
          : { earned: 0, max: 0 };
      }
      return {
        key,
        label: meta?.label || key,
        byDate,
      };
    });
  }, [days]);

  if (!days.length || days.length <= 1 || !rows.length) return null;

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-sm">
      <div className="border-b border-gray-100 bg-gray-50/80 px-4 py-2.5">
        <h2 className="text-xs font-bold uppercase tracking-wide text-gray-700">
          Parameter history (earned / max)
        </h2>
        <p className="mt-0.5 text-[10px] text-gray-500">
          Each cell shows points earned against that parameter&apos;s configured maximum.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-xs">
          <thead>
            <tr className="border-b border-gray-100 bg-white">
              <th className="sticky left-0 z-10 bg-white px-3 py-2 font-semibold text-gray-700">Parameter</th>
              {days.map((day) => (
                <th
                  key={day.date}
                  className={`px-2 py-2 font-semibold whitespace-nowrap ${
                    day.date === selectedDate ? 'text-emerald-700' : 'text-gray-600'
                  }`}
                >
                  {formatWellnessDayLabel(day.date, today)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-b border-gray-50">
                <td className="sticky left-0 z-10 bg-white px-3 py-2 font-medium text-gray-800">
                  {row.label}
                </td>
                {days.map((day) => {
                  const cell = row.byDate[day.date] || { earned: 0, max: 0 };
                  return (
                    <td
                      key={day.date}
                      className={`px-2 py-2 tabular-nums whitespace-nowrap ${
                        day.date === selectedDate ? 'bg-emerald-50/80 font-semibold text-gray-900' : 'text-gray-700'
                      }`}
                    >
                      {Math.round(cell.earned)}/{cell.max}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
