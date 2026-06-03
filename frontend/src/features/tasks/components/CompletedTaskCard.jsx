/**
 * CompletedTaskCard.jsx — Display completed task in Completed tab
 * 
 * Shows task completion info with checkmark
 *///

import React from 'react';
import { format, parseISO } from 'date-fns';

const CompletedTaskCard = ({ task }) => {
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
      weight: 'Weight Logged',
      breakfast: 'Breakfast Logged',
      lunch: 'Lunch Logged',
      dinner: 'Dinner Logged',
      education: 'Education Logged',
      water: 'Water Tracked'
    };
    return titles[type] || 'Task Completed';
  };

  const formatCompletionTime = (timestamp) => {
    if (!timestamp) return '';
    try {
      const date = parseISO(timestamp);
      return format(date, 'h:mm a');
    } catch (error) {
      return '';
    }
  };

  const getCompletionSummary = (task) => {
    if (!task.completion_data) return 'Completed successfully';

    const data = typeof task.completion_data === 'string' 
      ? JSON.parse(task.completion_data) 
      : task.completion_data;

    switch (task.task_type) {
      case 'weight':
        return data.weight ? `${data.weight} ${data.unit || 'kg'}` : 'Weight logged';
      case 'breakfast':
      case 'lunch':
      case 'dinner':
        return data.foodData?.items?.length 
          ? `${data.foodData.items.length} items logged`
          : 'Meal logged';
      case 'education':
        return data.activity || 'Activity logged';
      case 'water':
        return data.amount ? `${data.amount} ml` : 'Water logged';
      default:
        return 'Completed';
    }
  };

  return (
    <div className="bg-white rounded-xl p-4 border-2 border-gray-100 shadow-sm">
      <div className="flex items-center gap-3">
        {/* Icon with checkmark overlay */}
        <div className="relative">
          <div className="text-3xl opacity-70">
            {getTaskIcon(task.task_type)}
          </div>
          <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-0.5">
            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
        </div>

        {/* Info */}
        <div className="flex-1">
          <h3 className="font-semibold text-gray-700 text-sm">
            {getTaskTitle(task.task_type)}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {getCompletionSummary(task)}
          </p>
          <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {formatCompletionTime(task.completed_at)}
          </p>
        </div>
      </div>
    </div>
  );
};

export default CompletedTaskCard;
