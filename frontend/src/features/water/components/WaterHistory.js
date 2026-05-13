/**
 * WaterHistory.js — presentational.
 * Renders today's water log entries. Each `log` is pre-formatted by the hook.
 */
import React from 'react';

export default function WaterHistory({ logs }) {
  if (!logs || logs.length === 0) return null;
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
        Today's Logs
      </p>
      <div className="max-h-32 overflow-y-auto space-y-1">
        {logs.map((log, i) => (
          <div
            key={log.key ?? i}
            className="flex justify-between items-center px-3 py-1.5 bg-blue-50 rounded-lg text-xs text-blue-700"
          >
            <span>{log.timeLabel}</span>
            <span className="font-semibold">{log.volumeLabel}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
