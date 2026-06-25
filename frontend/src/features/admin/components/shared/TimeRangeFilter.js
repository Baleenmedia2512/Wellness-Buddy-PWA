/**
 * TimeRangeFilter.js — horizontally scrolling pill row with "Custom" toggle.
 */
import React from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';
import TouchFeedbackButton from '../../../../shared/components/TouchFeedbackButton';
import { TIME_RANGE_LABELS, TIME_RANGE_OPTIONS } from '../../services/dateRangeUtils';

const Pill = ({ active, onClick, label, ariaLabel, children }) => (
  <TouchFeedbackButton
    onClick={onClick} ariaLabel={ariaLabel || `Filter by ${label}`}
    className={`px-4 py-2.5 rounded-full text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 min-w-fit focus:outline-none focus:ring-0 cursor-pointer ${
      active ? 'bg-green-600 text-white shadow-md shadow-green-200' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
    }`}>
    {children || label}
  </TouchFeedbackButton>
);

export default function TimeRangeFilter({ timeRange, onSelectRange, showDatePicker, onToggleDatePicker, customRangeLabel }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide"
      style={{ WebkitOverflowScrolling: 'touch', scrollBehavior: 'smooth', overscrollBehaviorX: 'contain' }}>
      {TIME_RANGE_OPTIONS.map((range) => (
        <Pill key={range} active={timeRange === range} onClick={() => onSelectRange(range)}
          label={TIME_RANGE_LABELS[range]} />
      ))}
      <Pill active={timeRange === 'custom'} onClick={onToggleDatePicker} ariaLabel="Custom date range" label="Custom">
        <span className="flex items-center gap-1.5">
          <CalendarIcon className="w-4 h-4 flex-shrink-0" />
          <span>{timeRange === 'custom' ? customRangeLabel : 'Custom'}</span>
        </span>
      </Pill>
    </div>
  );
}
