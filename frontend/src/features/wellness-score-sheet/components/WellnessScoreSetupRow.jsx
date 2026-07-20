import React from 'react';
import {
  getParameterIcon,
  getScoringModeHint,
  SCORING_MODE_LABELS,
} from '../domain/parameterIcons';

/**
 * Admin config row — icon, toggle, scoring badge, max points.
 */
export default function WellnessScoreSetupRow({ category, config, onChange }) {
  const { enabled, maxPoints } = config;
  const Icon = getParameterIcon(category.key);
  const modeLabel = SCORING_MODE_LABELS[category.scoringMode] || category.scoringMode;
  const hint = getScoringModeHint(category.scoringMode, category.key, null, { adminView: true });

  const handleToggle = () => {
    onChange({ ...config, enabled: !enabled });
  };

  const handleMaxPoints = (e) => {
    const raw = parseInt(e.target.value, 10);
    const next = Number.isFinite(raw) ? Math.max(0, Math.min(1000, raw)) : 0;
    onChange({ ...config, maxPoints: next });
  };

  return (
    <div
      className={`rounded-xl border transition-colors ${
        enabled
          ? 'border-gray-200 bg-white shadow-sm'
          : 'border-gray-100 bg-gray-50/60'
      }`}
      data-testid={`wellness-setup-${category.key}`}
    >
      <div className="flex items-center gap-3 p-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${
            enabled
              ? 'border-emerald-100 bg-emerald-50'
              : 'border-gray-200 bg-gray-100'
          }`}
          aria-hidden
        >
          <Icon className={`h-5 w-5 ${enabled ? 'text-emerald-700' : 'text-gray-400'}`} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className={`truncate text-sm font-semibold ${enabled ? 'text-gray-900' : 'text-gray-500'}`}>
              {category.label}
            </p>
            <span
              className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                enabled
                  ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100'
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              {modeLabel}
            </span>
          </div>
          {hint && (
            <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-gray-500">{hint}</p>
          )}
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={handleToggle}
          className="shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1"
          aria-label={`${enabled ? 'Disable' : 'Enable'} ${category.label}`}
        >
          <span
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 ${
              enabled ? 'bg-emerald-500' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200 ${
                enabled ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </span>
        </button>
      </div>

      <div className="flex items-center justify-between border-t border-gray-100 px-3 py-2">
        <span className="text-xs font-medium text-gray-500">Max points</span>
        <div className="flex items-center gap-1.5">
          <label htmlFor={`max-${category.key}`} className="sr-only">
            Max points for {category.label}
          </label>
          <input
            id={`max-${category.key}`}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            min={0}
            max={1000}
            disabled={!enabled}
            value={maxPoints}
            onChange={handleMaxPoints}
            className="w-20 rounded-lg border border-gray-200 py-1.5 text-center text-sm font-bold tabular-nums focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-100 disabled:text-gray-400"
          />
          <span className="text-xs text-gray-400">pts</span>
        </div>
      </div>
    </div>
  );
}
