/**
 * WeightFormFields.js — presentational.
 * Numeric weight input + kg/lbs toggle. No state of its own.
 */
import React from 'react';

export default function WeightFormFields({ weight, unit, onWeightChange, onToggleUnit }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1.5">
        Weight Value
      </label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          value={weight}
          onChange={(e) => onWeightChange(e.target.value)}
          placeholder="e.g., 72.5"
          autoFocus
          className="flex-1 min-w-0 px-3 py-2.5 border-2 border-gray-300 rounded-xl focus:border-green-400 focus:outline-none text-sm font-semibold bg-white"
          style={{ fontSize: '16px' }}
        />
        <UnitToggle unit={unit} onToggle={onToggleUnit} />
      </div>
    </div>
  );
}

function UnitToggle({ unit, onToggle }) {
  return (
    <div
      className="relative flex items-center bg-gray-200 rounded-full p-1 cursor-pointer flex-shrink-0"
      onClick={onToggle}
      style={{ width: '76px', height: '36px' }}
    >
      <div
        className="absolute bg-green-500 rounded-full transition-all duration-300"
        style={{ width: '34px', height: '28px', left: unit === 'kg' ? '4px' : '38px' }}
      />
      <span className={`relative z-10 flex-1 text-center font-bold text-xs transition-colors ${unit === 'kg' ? 'text-white' : 'text-gray-500'}`}>kg</span>
      <span className={`relative z-10 flex-1 text-center font-bold text-xs transition-colors ${unit === 'lbs' ? 'text-white' : 'text-gray-500'}`}>lbs</span>
    </div>
  );
}
