// Weight goal mode toggle — Loss / Gain.
// Placed in the profile form, below DietDropdown.
import React from 'react';

const HINTS = {
  loss: 'App will alert you when weight increases unexpectedly.',
  gain: 'App will alert you when weight decreases unexpectedly.',
};

const WeightModeSelector = ({ value, onChange }) => {
  const isGain = value === 'gain';

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-gray-700">Weight Goal Mode</p>

      {/* Toggle pill */}
      <div
        className={`relative flex items-center w-full h-12 rounded-full p-1 cursor-pointer transition-colors duration-300
          ${isGain ? 'bg-blue-100' : 'bg-red-100'}`}
        onClick={() => onChange(isGain ? 'loss' : 'gain')}
        role="switch"
        aria-checked={isGain}
      >
        {/* Sliding thumb */}
        <div
          className={`absolute top-1 h-10 w-[calc(50%-4px)] rounded-full shadow-md flex items-center justify-center gap-2
            font-bold text-sm text-white transition-all duration-300
            ${isGain
              ? 'left-[calc(50%+2px)] bg-blue-500'
              : 'left-1 bg-red-500'
            }`}
        >
          <span>{isGain ? '💪' : '🔥'}</span>
          <span>{isGain ? 'Gain Mode' : 'Loss Mode'}</span>
        </div>

        {/* Background labels */}
        <div className="flex w-full">
          <div className={`flex-1 flex items-center justify-center gap-1 text-sm font-semibold
            ${!isGain ? 'text-transparent' : 'text-red-400'}`}>
            <span>🔥</span><span>Loss Mode</span>
          </div>
          <div className={`flex-1 flex items-center justify-center gap-1 text-sm font-semibold
            ${isGain ? 'text-transparent' : 'text-blue-400'}`}>
            <span>💪</span><span>Gain Mode</span>
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-400">{HINTS[value] || HINTS.loss}</p>
    </div>
  );
};

export default WeightModeSelector;
