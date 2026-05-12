import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, Check, Clock, Calendar as CalendarIcon } from 'lucide-react';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  isToday, 
  startOfWeek, 
  endOfWeek,
  setHours,
  setMinutes,
  getHours,
  getMinutes
} from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Reusable Bottom Sheet for Pickers
 */
const PickerSheet = ({ isOpen, onClose, title, children, onSave }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl z-[70] overflow-hidden max-h-[80vh] flex flex-col"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">{title}</h3>
              <button onClick={onClose} className="p-2 bg-gray-50 rounded-full hover:bg-gray-100">
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              {children}
            </div>
            <div className="p-6 pt-2 border-t border-gray-50 bg-white">
              <button
                onClick={onSave}
                className="w-full py-3.5 bg-green-600 text-white rounded-xl font-bold shadow-lg shadow-green-200 active:scale-[0.98] transition-transform"
              >
                Confirm
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

/**
 * Mobile-First Date Picker
 */
export const MobileDatePicker = ({ isOpen, onClose, value, onChange, label }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(value ? new Date(value) : new Date());

  useEffect(() => {
    if (isOpen && value) {
      const date = new Date(value);
      setSelectedDate(date);
      setCurrentMonth(date);
    }
  }, [isOpen, value]);

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentMonth)),
    end: endOfWeek(endOfMonth(currentMonth))
  });

  const handleSave = () => {
    onChange(format(selectedDate, 'yyyy-MM-dd'));
    onClose();
  };

  return (
    <PickerSheet isOpen={isOpen} onClose={onClose} title={label || "Select Date"} onSave={handleSave}>
      <div className="mb-4 flex items-center justify-between">
        <button 
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className="p-2 hover:bg-gray-100 rounded-full"
        >
          <ChevronLeft className="h-5 w-5 text-gray-600" />
        </button>
        <h4 className="font-bold text-lg text-gray-900">
          {format(currentMonth, 'MMMM yyyy')}
        </h4>
        <button 
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="p-2 hover:bg-gray-100 rounded-full"
        >
          <ChevronRight className="h-5 w-5 text-gray-600" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
          <div key={day} className="text-center text-xs font-bold text-gray-400 py-2">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day, idx) => {
          const isSelected = isSameDay(day, selectedDate);
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isTodayDate = isToday(day);

          return (
            <button
              key={idx}
              onClick={() => setSelectedDate(day)}
              className={`
                aspect-square rounded-xl flex items-center justify-center text-sm font-medium transition-all
                ${isSelected 
                  ? 'bg-green-600 text-white shadow-md shadow-green-200 scale-105' 
                  : isCurrentMonth 
                    ? 'text-gray-900 hover:bg-gray-50' 
                    : 'text-gray-300'
                }
                ${isTodayDate && !isSelected ? 'border border-green-200 text-green-600' : ''}
              `}
            >
              {format(day, 'd')}
            </button>
          );
        })}
      </div>
    </PickerSheet>
  );
};

/**
 * Mobile-First Time Picker
 */
export const MobileTimePicker = ({ isOpen, onClose, value, onChange, label }) => {
  // Parse initial value "HH:MM"
  const parseTime = (timeStr) => {
    if (!timeStr) return { hours: 12, minutes: 0 };
    const [h, m] = timeStr.split(':').map(Number);
    return { hours: h, minutes: m };
  };

  const [selectedTime, setSelectedTime] = useState(parseTime(value));
  const [mode, setMode] = useState('hours'); // 'hours' or 'minutes'

  useEffect(() => {
    if (isOpen) {
      setSelectedTime(parseTime(value));
      setMode('hours');
    }
  }, [isOpen, value]);

  const handleSave = () => {
    const h = selectedTime.hours.toString().padStart(2, '0');
    const m = selectedTime.minutes.toString().padStart(2, '0');
    onChange(`${h}:${m}`);
    onClose();
  };

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: 12 }, (_, i) => i * 5); // 5 minute steps

  return (
    <PickerSheet isOpen={isOpen} onClose={onClose} title={label || "Select Time"} onSave={handleSave}>
      {/* Digital Clock Display */}
      <div className="flex justify-center mb-8">
        <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-2xl border border-gray-100">
          <button
            onClick={() => setMode('hours')}
            className={`px-6 py-4 rounded-xl text-4xl font-bold transition-all ${
              mode === 'hours' 
                ? 'bg-white text-green-600 shadow-sm ring-1 ring-green-100' 
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {selectedTime.hours.toString().padStart(2, '0')}
          </button>
          <span className="text-2xl font-bold text-gray-300">:</span>
          <button
            onClick={() => setMode('minutes')}
            className={`px-6 py-4 rounded-xl text-4xl font-bold transition-all ${
              mode === 'minutes' 
                ? 'bg-white text-green-600 shadow-sm ring-1 ring-green-100' 
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {selectedTime.minutes.toString().padStart(2, '0')}
          </button>
        </div>
      </div>

      {/* Grid Selection */}
      <div className="h-64 overflow-y-auto">
        <div className="grid grid-cols-4 gap-3">
          {mode === 'hours' ? (
            hours.map(hour => (
              <button
                key={hour}
                onClick={() => {
                  setSelectedTime(prev => ({ ...prev, hours: hour }));
                  setMode('minutes'); // Auto-advance
                }}
                className={`
                  py-3 rounded-xl text-lg font-medium transition-all
                  ${selectedTime.hours === hour 
                    ? 'bg-green-600 text-white shadow-md shadow-green-200' 
                    : 'bg-white border border-gray-100 text-gray-700 hover:bg-gray-50'
                  }
                `}
              >
                {hour.toString().padStart(2, '0')}
              </button>
            ))
          ) : (
            minutes.map(minute => (
              <button
                key={minute}
                onClick={() => setSelectedTime(prev => ({ ...prev, minutes: minute }))}
                className={`
                  py-3 rounded-xl text-lg font-medium transition-all
                  ${selectedTime.minutes === minute 
                    ? 'bg-green-600 text-white shadow-md shadow-green-200' 
                    : 'bg-white border border-gray-100 text-gray-700 hover:bg-gray-50'
                  }
                `}
              >
                {minute.toString().padStart(2, '0')}
              </button>
            ))
          )}
        </div>
      </div>
    </PickerSheet>
  );
};
