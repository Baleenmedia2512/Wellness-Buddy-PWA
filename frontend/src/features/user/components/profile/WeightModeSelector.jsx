// Weight goal mode toggle — Loss / Gain.
// Placed in the profile form, below DietDropdown.
import React from 'react';

const MODES = [
  {
    value: 'loss',
    label: 'Loss Mode',
    emoji: '🔥',
    activeClass: 'bg-red-500 text-white border-red-500 shadow-md',
    idleClass: 'bg-white text-red-600 border-red-300 hover:bg-red-50',
    hint: 'App will alert you when weight increases unexpectedly.',
  },
  {
    value: 'gain',
    label: 'Gain Mode',
    emoji: '💪',
    activeClass: 'bg-blue-500 text-white border-blue-500 shadow-md',
    idleClass: 'bg-white text-blue-600 border-blue-300 hover:bg-blue-50',
    hint: 'App will alert you when weight decreases unexpectedly.',
  },
];

const WeightModeSelector = ({ value, onChange }) => {
  const active = MODES.find((m) => m.value === value) || MODES[0];
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-gray-700">Weight Goal Mode</p>
      <div className="flex gap-3">
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => onChange(m.value)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 font-semibold text-sm transition-all
              ${value === m.value ? m.activeClass : m.idleClass}`}
          >
            <span className="text-base">{m.emoji}</span>
            <span>{m.label}</span>
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-400">{active.hint}</p>
    </div>
  );
};

export default WeightModeSelector;
