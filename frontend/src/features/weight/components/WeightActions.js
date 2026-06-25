/**
 * WeightActions.js — small slice-internal UI controls.
 *
 * Houses the segmented panel toggle (Summary/Trend), the trend-range
 * selector (7D/14D/30D), and the bottom dot navigator. All controls are
 * presentational: they receive the active value plus a setter.
 */
import React from 'react';

const PILL = 'px-2.5 py-1 text-[11px] md:text-xs rounded-full transition-all duration-300';
const ACTIVE = 'bg-emerald-500 text-white shadow-sm';
const INACTIVE = 'text-gray-600 hover:bg-white';

export const WeightPanelToggle = ({ active, onChange }) => (
  <div className="flex items-center gap-1 bg-gray-100 rounded-full p-1">
    <button
      type="button"
      onClick={() => onChange('summary')}
      className={`${PILL} ${active === 'summary' ? ACTIVE : INACTIVE}`}
    >
      Summary
    </button>
    <button
      type="button"
      onClick={() => onChange('trend')}
      className={`${PILL} ${active === 'trend' ? ACTIVE : INACTIVE}`}
    >
      Trend
    </button>
  </div>
);

export const WeightTrendRangeSelector = ({ selectedDays, onSelect }) => (
  <div className="flex items-center gap-1 bg-gray-100 rounded-full p-1">
    {[7, 14, 30].map((days) => (
      <button
        key={days}
        type="button"
        onClick={() => onSelect(days)}
        className={`${PILL} ${selectedDays === days ? ACTIVE : INACTIVE}`}
      >
        {days}D
      </button>
    ))}
  </div>
);

export const WeightPanelDots = ({ active, onSelect }) => (
  <div className="pb-3 md:pb-4 flex items-center justify-center gap-1.5">
    {['summary', 'trend'].map((slide) => (
      <button
        key={slide}
        type="button"
        aria-label={`Go to weight ${slide} slide`}
        onClick={() => onSelect(slide)}
        style={{ width: 7, height: 7, minWidth: 0, minHeight: 0, padding: 0 }}
        className={`rounded-full transition-all duration-300 ${
          active === slide ? 'bg-emerald-500' : 'bg-gray-300 hover:bg-gray-400'
        }`}
      />
    ))}
  </div>
);
