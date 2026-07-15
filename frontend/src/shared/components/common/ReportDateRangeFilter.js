import React, { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import TouchFeedbackButton from '../TouchFeedbackButton';
import DateRangePicker from './DateRangePicker';
import { formatCustomRangeLabel } from '../../domain/reportDateRanges';

/**
 * Date-range pill bar + calendar picker — same UX as Activity / Club reports.
 */
export default function ReportDateRangeFilter({
  ranges,
  dateRange,
  onDateRangeChange,
  customStartDate = null,
  customEndDate = null,
  onCustomDateSelect,
  className = '',
}) {
  const [showDatePicker, setShowDatePicker] = useState(false);

  const handleRangeClick = (range) => {
    onDateRangeChange(range);
    if (range === 'custom') {
      setShowDatePicker(true);
    } else {
      setShowDatePicker(false);
    }
  };

  const handleCustomSelect = (start, end) => {
    onCustomDateSelect(start, end);
    setShowDatePicker(false);
  };

  return (
    <div className={className}>
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {ranges.map((range) => (
          <TouchFeedbackButton
            key={range.value}
            onClick={() => handleRangeClick(range.value)}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-all whitespace-nowrap flex-shrink-0 ${
              dateRange === range.value
                ? 'bg-green-600 text-white shadow-md'
                : 'bg-white text-gray-700 border border-gray-200 hover:border-green-400'
            }`}
          >
            {range.value === 'custom'
              ? (dateRange === 'custom' ? formatCustomRangeLabel(customStartDate, customEndDate) : range.label)
              : range.label}
          </TouchFeedbackButton>
        ))}
      </div>

      <AnimatePresence>
        {showDatePicker && dateRange === 'custom' && (
          <div className="mt-4">
            <DateRangePicker
              startDate={customStartDate}
              endDate={customEndDate}
              onSelect={handleCustomSelect}
              onClose={() => setShowDatePicker(false)}
            />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
