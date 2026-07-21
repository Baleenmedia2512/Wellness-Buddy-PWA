import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Calendar date-range picker — shared by Activity Report, Wellness Score, etc.
 */
export default function DateRangePicker({ startDate, endDate, onSelect, onClose, singleDay = false }) {
  const [currentMonth, setCurrentMonth] = useState(() => startDate || new Date());
  const [selectingStart, setSelectingStart] = useState(true);
  const [tempStart, setTempStart] = useState(startDate);
  const [tempEnd, setTempEnd] = useState(endDate);

  const daysInMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const getFirstDayOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();

  const isFuture = (day) => {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return date > today;
  };

  const handleDateClick = (day) => {
    if (isFuture(day)) return;
    const clickedDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);

    if (singleDay) {
      setTempStart(clickedDate);
      setTempEnd(clickedDate);
      onSelect(clickedDate, clickedDate);
      return;
    }

    if (selectingStart) {
      setTempStart(clickedDate);
      setTempEnd(null);
      setSelectingStart(false);
      return;
    }

    if (clickedDate < tempStart) {
      setTempEnd(tempStart);
      setTempStart(clickedDate);
      onSelect(clickedDate, tempStart);
    } else {
      setTempEnd(clickedDate);
      onSelect(tempStart, clickedDate);
    }
  };

  const isInRange = (day) => {
    if (!tempStart || !tempEnd) return false;
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    return date >= tempStart && date <= tempEnd;
  };

  const isStartDate = (day) => {
    if (!tempStart) return false;
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    return date.toDateString() === tempStart.toDateString();
  };

  const isEndDate = (day) => {
    if (!tempEnd) return false;
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    return date.toDateString() === tempEnd.toDateString();
  };

  const blanks = Array(getFirstDayOfMonth(currentMonth)).fill(null);
  const dayNumbers = Array.from({ length: daysInMonth(currentMonth) }, (_, i) => i + 1);

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="bg-white rounded-xl shadow-lg p-4 border border-gray-200"
    >
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
          className="p-2 hover:bg-gray-100 rounded-lg"
          aria-label="Previous month"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h3 className="text-lg font-semibold">
          {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </h3>
        <button
          type="button"
          onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
          className="p-2 hover:bg-gray-100 rounded-lg"
          aria-label="Next month"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
          <div key={day} className="h-8 flex items-center justify-center text-xs font-semibold text-gray-600">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {blanks.map((_, i) => (
          <div key={`blank-${i}`} className="h-10" />
        ))}
        {dayNumbers.map((day) => {
          const future = isFuture(day);
          const inRange = isInRange(day);
          const isStart = isStartDate(day);
          const isEnd = isEndDate(day);
          return (
            <button
              key={day}
              type="button"
              onClick={() => handleDateClick(day)}
              disabled={future}
              className={`h-10 flex items-center justify-center text-sm rounded-lg transition-colors ${
                future
                  ? 'text-gray-300 cursor-not-allowed'
                  : isStart || isEnd
                    ? 'bg-green-600 text-white font-bold'
                    : inRange
                      ? 'bg-green-100 text-green-800'
                      : 'hover:bg-gray-100'
              }`}
            >
              {day}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex justify-between items-center">
        <p className="text-xs text-gray-600">
          {singleDay ? 'Select a date' : selectingStart ? 'Select start date' : 'Select end date'}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors"
        >
          Done
        </button>
      </div>
    </motion.div>
  );
}
