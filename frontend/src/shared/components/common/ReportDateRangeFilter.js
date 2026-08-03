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
  variant = 'default',
}) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const isCompact = variant === 'compact';

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

  const pillClass = isCompact
    ? 'block w-full min-w-0 px-1.5 py-1 rounded-full text-[10px] sm:text-[11px] font-semibold leading-tight text-center truncate'
    : 'px-3 py-1 rounded-full text-xs font-semibold';

  const containerClass = isCompact
    ? 'grid grid-cols-3 gap-1.5 sm:gap-2 w-full'
    : 'flex gap-2 overflow-x-auto pb-1 no-scrollbar';

  return (
    <div className={className}>
      <div className={containerClass}>
        {ranges.map((range) => (
          <TouchFeedbackButton
            key={range.value}
            onClick={() => handleRangeClick(range.value)}
            className={`${pillClass} transition-all flex-shrink-0 ${
              dateRange === range.value
                ? 'bg-green-600 text-white shadow-sm'
                : 'bg-white text-gray-700 border border-gray-200 hover:border-green-400'
            }`}
            title={
              range.value === 'custom' && dateRange === 'custom'
                ? formatCustomRangeLabel(customStartDate, customEndDate)
                : range.label
            }
          >
            {range.value === 'custom'
              ? (dateRange === 'custom' ? formatCustomRangeLabel(customStartDate, customEndDate) : range.label)
              : range.label}
          </TouchFeedbackButton>
        ))}
      </div>

      <AnimatePresence>
        {showDatePicker && dateRange === 'custom' && (
          <div className={`${isCompact ? 'mt-2' : 'mt-4'} w-full`}>
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
