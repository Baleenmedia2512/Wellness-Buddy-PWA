/**
 * DateRangePicker.js — inline calendar for selecting a custom range.
 *
 * Extracted verbatim from the original AdminDashboard. Future work:
 * could be promoted to shared/components if other features need it.
 */
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const useCalendarMonth = (date) => {
  const days = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  return { days, firstDay };
};

const eqDate = (a, b) => a && b && a.toDateString() === b.toDateString();

export default function DateRangePicker({ startDate, endDate, onSelect, onClose }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectingStart, setSelectingStart] = useState(true);
  const [tempStart, setTempStart] = useState(startDate);
  const [tempEnd, setTempEnd] = useState(endDate);

  const buildDate = (day) => new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
  const isFutureDate = (day) => {
    const d = buildDate(day);
    const today = new Date(); today.setHours(23, 59, 59, 999);
    return d > today;
  };
  const isInRange = (day) => {
    if (!tempStart || !tempEnd) return false;
    const d = buildDate(day);
    return d >= tempStart && d <= tempEnd;
  };

  const handleDateClick = (day) => {
    const clicked = buildDate(day);
    if (isFutureDate(day)) return;
    if (selectingStart) {
      setTempStart(clicked); setTempEnd(null); setSelectingStart(false);
    } else {
      const newStart = clicked < tempStart ? clicked : tempStart;
      const newEnd = clicked < tempStart ? tempStart : clicked;
      setTempStart(newStart); setTempEnd(newEnd);
      setTimeout(() => onSelect(newStart, newEnd), 200);
    }
  };

  const { days, firstDay } = useCalendarMonth(currentMonth);
  const dayNumbers = Array.from({ length: days }, (_, i) => i + 1);
  const stepMonth = (delta) => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + delta));

  const dayClass = (day) => {
    if (isFutureDate(day)) return 'text-gray-300 cursor-not-allowed';
    if (eqDate(buildDate(day), tempStart) || eqDate(buildDate(day), tempEnd)) return 'bg-green-600 text-white font-bold shadow-md';
    if (isInRange(day)) return 'bg-green-100 text-green-700';
    return 'hover:bg-gray-100 text-gray-700';
  };

  return (
    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
      className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4 mb-4">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => stepMonth(-1)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="text-center">
          <h3 className="font-semibold text-gray-800">
            {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </h3>
          <p className="text-xs text-gray-500 mt-1">{selectingStart ? 'Select start date' : 'Select end date'}</p>
        </div>
        <button onClick={() => stepMonth(1)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ChevronRight className="w-5 h-5 text-gray-600" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
          <div key={d} className="text-center text-xs font-medium text-gray-500 py-2">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array(firstDay).fill(null).map((_, i) => <div key={`b-${i}`} className="aspect-square" />)}
        {dayNumbers.map((day) => (
          <button key={day} onClick={() => handleDateClick(day)} disabled={isFutureDate(day)}
            className={`aspect-square flex items-center justify-center text-sm rounded-lg transition-all ${dayClass(day)}`}>
            {day}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
        <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
        <button onClick={() => { setTempStart(null); setTempEnd(null); setSelectingStart(true); }}
          className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Clear</button>
      </div>
    </motion.div>
  );
}
