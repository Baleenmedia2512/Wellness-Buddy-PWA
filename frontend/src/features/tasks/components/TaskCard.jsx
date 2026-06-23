/**
 * TaskCard.jsx — Individual task card in To Do list
 * 
 * Shows task icon, title, time window, and action button
 * Triggers camera/completion flow when clicked
 */

import React from 'react';
import { motion } from 'framer-motion';

const TaskCard = ({ task, onClick, isHighlighted = false }) => {
  const getTaskIcon = (type) => {
    const icons = {
      weight: '⚖️',
      breakfast: '🍳',
      lunch: '🍽️',
      dinner: '🌙',
      education: '📚',
      water: '💧'
    };
    return icons[type] || '📋';
  };

  const getTaskTitle = (type) => {
    const titles = {
      weight: 'Log Morning Weight',
      breakfast: 'Log Breakfast',
      lunch: 'Log Lunch',
      dinner: 'Log Dinner',
      education: 'Log Education Activity',
      water: 'Track Water Intake'
    };
    return titles[type] || 'Complete Task';
  };

  const getActionText = (type) => {
    if (type === 'weight') return '📸 Upload Now';
    if (['breakfast', 'lunch', 'dinner', 'education'].includes(type)) return '📸 Upload Now';
    if (type === 'water') return '💧 Log Water Now';
    return '✓ Complete';
  };

  const formatTime = (timeString) => {
    if (!timeString) return '';
    // Convert 24h to 12h format
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileTap={{ scale: 0.98 }}
      className={`bg-white rounded-xl p-4 shadow-sm border-2 transition-all cursor-pointer ${
        isHighlighted
          ? 'border-green-500 shadow-lg ring-2 ring-green-200'
          : 'border-gray-200 hover:border-green-300 hover:shadow-md'
      }`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between gap-4">
        {/* Icon and Info */}
        <div className="flex items-center gap-3 flex-1">
          <div className="text-4xl flex-shrink-0">
            {getTaskIcon(task.task_type)}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-800 text-base mb-1">
              {getTaskTitle(task.task_type)}
            </h3>
            <div className="flex items-center gap-1 text-sm text-gray-500">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>
                {formatTime(task.window_start)} - {formatTime(task.window_end)}
              </span>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <button
          className="bg-green-500 hover:bg-green-600 active:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold text-sm whitespace-nowrap shadow-sm transition-colors flex items-center gap-2"
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
        >
          {getActionText(task.task_type)}
        </button>
      </div>
    </motion.div>
  );
};

export default TaskCard;
