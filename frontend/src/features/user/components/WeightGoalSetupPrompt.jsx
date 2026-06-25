/**
 * WeightGoalSetupPrompt.jsx
 *
 * Forced one-time modal shown when a user has never set their Weight Goal Mode.
 * Cannot be dismissed without selecting a mode — user MUST choose Loss or Gain.
 *
 * Triggered by App.js after profile load when weightGoalMode === null.
 */
import React, { useState } from 'react';

const HINTS = {
  loss: 'App will alert you when weight increases unexpectedly.',
  gain: 'App will alert you when weight decreases unexpectedly.',
};

export function WeightGoalSetupPrompt({ isOpen, onSave }) {
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const isGain = selected === 'gain';

  const handleToggle = () => {
    if (selected === null) {
      setSelected('loss');
    } else {
      setSelected(isGain ? 'loss' : 'gain');
    }
    setError('');
  };

  const handleSave = async () => {
    if (!selected) {
      setError('Please select your goal mode to continue.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave(selected);
    } catch (e) {
      setError(e.message || 'Failed to save. Please try again.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black bg-opacity-70 p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-green-500 to-teal-500 p-6 text-white text-center">
          <div className="text-4xl mb-2">🎯</div>
          <h2 className="text-xl font-bold">Set Your Weight Goal</h2>
          <p className="text-sm text-green-100 mt-1">
            This helps us personalise your progress tracking
          </p>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600 text-center font-medium">
            What is your current goal?
          </p>

          {/* Toggle pill */}
          <div
            className={`relative flex items-center w-full h-12 rounded-full p-1 cursor-pointer transition-colors duration-300
              ${selected === null ? 'bg-gray-100' : isGain ? 'bg-blue-100' : 'bg-red-100'}`}
            onClick={handleToggle}
            role="switch"
            aria-checked={isGain}
          >
            {/* Sliding thumb — only show when selected */}
            {selected !== null && (
              <div
                className={`absolute top-1 h-10 w-[calc(50%-4px)] rounded-full shadow-md flex items-center justify-center gap-2
                  font-bold text-sm text-white transition-all duration-300
                  ${isGain ? 'left-[calc(50%+2px)] bg-blue-500' : 'left-1 bg-red-500'}`}
              >
                <span>{isGain ? '💪' : '🔥'}</span>
                <span>{isGain ? 'Gain Mode' : 'Loss Mode'}</span>
              </div>
            )}

            {/* Background labels */}
            <div className="flex w-full">
              <div className={`flex-1 flex items-center justify-center gap-1 text-sm font-semibold
                ${selected !== null && !isGain ? 'text-transparent' : 'text-red-400'}`}>
                <span>🔥</span><span>Loss Mode</span>
              </div>
              <div className={`flex-1 flex items-center justify-center gap-1 text-sm font-semibold
                ${selected !== null && isGain ? 'text-transparent' : 'text-blue-400'}`}>
                <span>💪</span><span>Gain Mode</span>
              </div>
            </div>
          </div>

          {selected && (
            <p className="text-xs text-gray-400 text-center">{HINTS[selected]}</p>
          )}

          {error && (
            <p className="text-xs text-red-600 text-center font-medium">{error}</p>
          )}

          <p className="text-[11px] text-gray-400 text-center">
            You can change this later from your Profile settings
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6">
          <button
            onClick={handleSave}
            disabled={saving || !selected}
            className={`w-full py-3 rounded-xl font-bold text-sm transition-all
              ${selected
                ? 'bg-gradient-to-r from-green-500 to-teal-500 text-white hover:from-green-600 hover:to-teal-600 shadow-md'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
          >
            {saving ? 'Saving...' : 'Continue →'}
          </button>
        </div>

      </div>
    </div>
  );
}
