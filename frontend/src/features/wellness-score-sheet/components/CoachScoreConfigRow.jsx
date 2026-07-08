import React from 'react';

const SCORING_HINTS = {
  binary: 'Full mark if done on time',
  limit: '0 if over limit; else proportional',
  proportional: 'Mark scales with % of target',
  deferred: 'Not active yet',
};

/**
 * Coach config row — enable toggle + max mark input.
 */
export default function CoachScoreConfigRow({ param, config, onChange }) {
  const { enabled, maxMark } = config;
  const disabled = param.scoringType === 'deferred';

  const handleToggle = () => {
    if (disabled) return;
    onChange({ ...config, enabled: !enabled });
  };

  const handleMaxMark = (e) => {
    const raw = parseInt(e.target.value, 10);
    const next = Number.isFinite(raw) ? Math.max(0, Math.min(1000, raw)) : 0;
    onChange({ ...config, maxMark: next });
  };

  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-xl border ${
        disabled
          ? 'bg-gray-50 border-gray-200 opacity-70'
          : enabled
            ? 'bg-white border-emerald-200/80 shadow-sm'
            : 'bg-gray-50/80 border-gray-200'
      }`}
      data-testid={`coach-config-${param.key}`}
    >
      <button
        type="button"
        role="switch"
        aria-checked={enabled && !disabled}
        disabled={disabled}
        onClick={handleToggle}
        className={`relative shrink-0 w-10 h-6 rounded-full transition-colors ${
          disabled ? 'bg-gray-200 cursor-not-allowed' : enabled ? 'bg-emerald-500' : 'bg-gray-300'
        }`}
        aria-label={`Enable ${param.label}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
            enabled && !disabled ? 'translate-x-4' : ''
          }`}
        />
      </button>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{param.label}</p>
        <p className="text-[10px] text-gray-500">
          {SCORING_HINTS[param.scoringType] || param.scoringType}
        </p>
      </div>

      <div className="shrink-0 flex items-center gap-1">
        <label htmlFor={`max-${param.key}`} className="sr-only">
          Max mark for {param.label}
        </label>
        <input
          id={`max-${param.key}`}
          type="number"
          min={0}
          max={1000}
          disabled={disabled || !enabled}
          value={maxMark}
          onChange={handleMaxMark}
          className="w-16 text-center text-sm font-bold border border-gray-200 rounded-lg py-1.5 px-1 disabled:bg-gray-100 disabled:text-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
        />
        <span className="text-[10px] text-gray-400 w-6">pts</span>
      </div>
    </div>
  );
}
