/**
 * ScreenAppBreakdown.js — presentational.
 *
 * Collapsible per-app usage list (tracked apps highlighted, then up to 10
 * "other" apps with an overflow counter). Render-only.
 */
import React from 'react';
import { Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { formatScreenTime } from '../services/screenTimeService';

export default function ScreenAppBreakdown({
  appUsage, trackedApps, otherApps, totalSeconds, isOpen, onToggle,
}) {
  if (!appUsage || appUsage.length === 0) return null;
  return (
    <div>
      <button
        onClick={onToggle}
        className="flex items-center justify-between w-full py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
      >
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          <span>App Breakdown ({appUsage.length} apps)</span>
        </div>
        {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {isOpen && (
        <div className="space-y-1.5 mt-1">
          {trackedApps.map((app, idx) => (
            <AppUsageRow key={`tracked-${idx}`} app={app} totalSeconds={totalSeconds} highlight />
          ))}
          {otherApps.slice(0, 10).map((app, idx) => (
            <AppUsageRow key={`other-${idx}`} app={app} totalSeconds={totalSeconds} />
          ))}
          {otherApps.length > 10 && (
            <p className="text-xs text-gray-400 text-center pt-1">
              +{otherApps.length - 10} more apps
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function AppUsageRow({ app, totalSeconds, highlight }) {
  const percent = totalSeconds > 0 ? Math.round((app.usageSeconds / totalSeconds) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <span className={`text-xs truncate ${highlight ? 'font-medium text-gray-800' : 'text-gray-600'}`}>
            {app.appName}
          </span>
          <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
            {formatScreenTime(app.usageSeconds)}
          </span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-1.5">
          <div
            className={`h-1.5 rounded-full ${highlight ? 'bg-blue-500' : 'bg-gray-300'}`}
            style={{ width: `${Math.max(percent, 1)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
