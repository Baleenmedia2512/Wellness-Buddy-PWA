/**
 * ScreenUsageChart.js — presentational.
 *
 * Renders a tiny daily bar chart. Bars are pre-computed by `useScreenMetrics`
 * (`{ date, seconds, heightPercent, dayLabel }`), so this file does no math.
 */
import React from 'react';
import { BarChart3 } from 'lucide-react';
import { formatScreenTime } from '../services/screenTimeService';

export default function ScreenUsageChart({ bars }) {
  if (!bars || bars.length === 0) return null;
  return (
    <div className="mb-3">
      <div className="flex items-center gap-1 mb-2">
        <BarChart3 className="w-3.5 h-3.5 text-gray-400" />
        <span className="text-xs text-gray-500">Daily Usage</span>
      </div>
      <div className="flex items-end gap-0.5 h-16">
        {bars.map((bar, idx) => (
          <div
            key={`${bar.date}-${idx}`}
            className="flex-1 flex flex-col items-center"
            title={`${bar.dayLabel}: ${formatScreenTime(bar.seconds)}`}
          >
            <div
              className="w-full bg-blue-400 rounded-t-sm min-h-[2px]"
              style={{ height: `${Math.max(bar.heightPercent, 3)}%` }}
            />
            <span className="text-[9px] text-gray-400 mt-0.5">{bar.dayLabel}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
