/**
 * WaterControls.js — presentational.
 * Quick-log buttons + custom-amount input. All state lives in the parent hook.
 */
import React from 'react';
import { Plus } from 'lucide-react';

// Quick-log amounts in ml. Pure data — kept here because it is part of the UI.
const QUICK_AMOUNTS = [
  { label: '250 ml', value: 250 },
  { label: '500 ml', value: 500 },
  { label: '1 L', value: 1000 },
  { label: '2 L', value: 2000 },
];

export default function WaterControls({
  saving,
  onLog,
  showCustom,
  customMl,
  onCustomChange,
  onOpenCustom,
  onSubmitCustom,
  onCloseCustom,
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
        Quick Log
      </p>
      <div className="grid grid-cols-4 gap-2">
        {QUICK_AMOUNTS.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => onLog(value)}
            disabled={saving}
            className={`py-2 px-1 rounded-xl text-xs font-semibold border transition-all duration-150
              ${
                saving
                  ? 'opacity-50 cursor-not-allowed bg-gray-50 border-gray-200 text-gray-400'
                  : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 active:scale-95'
              }`}
          >
            {label}
          </button>
        ))}
      </div>

      {showCustom ? (
        <div className="flex gap-2">
          <input
            type="number"
            min="1"
            max="5000"
            placeholder="Amount in ml"
            value={customMl}
            onChange={(e) => onCustomChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSubmitCustom()}
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
            autoFocus
          />
          <button
            onClick={onSubmitCustom}
            disabled={saving}
            className="px-4 py-2 bg-blue-500 text-white rounded-xl text-sm font-semibold hover:bg-blue-600 active:scale-95 transition-all disabled:opacity-50"
          >
            Log
          </button>
          <button
            onClick={onCloseCustom}
            className="px-3 py-2 bg-gray-100 text-gray-500 rounded-xl text-sm hover:bg-gray-200 transition-all"
          >
            ✕
          </button>
        </div>
      ) : (
        <button
          onClick={onOpenCustom}
          className="w-full flex items-center justify-center gap-1 py-2 border border-dashed border-blue-300 rounded-xl text-blue-500 text-sm hover:bg-blue-50 transition-all"
        >
          <Plus className="w-4 h-4" />
          Custom amount
        </button>
      )}
    </div>
  );
}
