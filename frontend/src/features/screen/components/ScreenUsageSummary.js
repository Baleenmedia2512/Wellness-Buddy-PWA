/**
 * ScreenUsageSummary.js — presentational.
 *
 * "Today" total + (optional) period-average tile, plus the period
 * selector pills underneath. Render-only.
 */
import React from 'react';
import { formatScreenTime } from '../services/screenTimeService';

const PERIOD_OPTIONS = [
  { label: 'Today', days: 1 },
  { label: '7 Days', days: 7 },
  { label: '30 Days', days: 30 },
];

export default function ScreenUsageSummary({
  todaySeconds, avgSeconds, selectedPeriod, onPeriodChange,
}) {
  return (
    <>
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-3 mb-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 mb-1">Today</p>
            <p className="text-2xl font-bold text-gray-800">{formatScreenTime(todaySeconds)}</p>
          </div>
          {avgSeconds > 0 && (
            <div className="text-right">
              <p className="text-xs text-gray-500 mb-1">Avg ({selectedPeriod}d)</p>
              <p className="text-lg font-semibold text-gray-600">{formatScreenTime(avgSeconds)}</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-1 mb-3">
        {PERIOD_OPTIONS.map((opt) => (
          <button
            key={opt.days}
            onClick={() => onPeriodChange(opt.days)}
            className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              selectedPeriod === opt.days
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </>
  );
}
