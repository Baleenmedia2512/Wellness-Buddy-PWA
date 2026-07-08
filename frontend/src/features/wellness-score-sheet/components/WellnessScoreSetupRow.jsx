import React from 'react';

const SCORING_HINTS = {
  binary: 'On-time → full points; late or missed → 0',
  proportional: 'Proportional to target; capped at max points',
  limit: 'At or below limit → full; above limit → 0',
};

/**
 * Admin config row — enable toggle + max points input.
 */
export default function WellnessScoreSetupRow({ category, config, onChange }) {
  const { enabled, maxPoints } = config;
  const hint = SCORING_HINTS[category.scoringMode] || '';

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
      className={`flex items-center gap-3 p-3 rounded-xl border ${
        enabled
          ? 'bg-white border-emerald-200/80 shadow-sm'
          : 'bg-gray-50/80 border-gray-200'
      }`}
      data-testid={`wellness-setup-${category.key}`}
    >
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={handleToggle}
        className={`relative shrink-0 w-10 h-6 rounded-full transition-colors ${
          enabled ? 'bg-emerald-500' : 'bg-gray-300'
        }`}
        aria-label={`Enable ${category.label}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
            enabled ? 'translate-x-4' : ''
          }`}
        />
      </button>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{category.label}</p>
        {hint && <p className="text-[10px] text-gray-500">{hint}</p>}
      </div>

      <div className="shrink-0 flex items-center gap-1">
        <label htmlFor={`max-${category.key}`} className="sr-only">
          Max points for {category.label}
        </label>
        <input
          id={`max-${category.key}`}
          type="number"
          min={0}
          max={1000}
          disabled={!enabled}
          value={maxPoints}
          onChange={handleMaxPoints}
          className="w-16 text-center text-sm font-bold border border-gray-200 rounded-lg py-1.5 px-1 disabled:bg-gray-100 disabled:text-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
        />
        <span className="text-[10px] text-gray-400 w-6">pts</span>
      </div>
    </div>
  );
}
