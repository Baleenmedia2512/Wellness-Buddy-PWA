/**
 * task-rules.js — Core business logic for time-based tasks
 * 
 * Pure domain logic (no I/O, no DB, no network).
 * Per claude.md §3.1: Domain layer is pure — given inputs, returns outputs.
 * 
 * Responsibilities:
 * - Task visibility logic (when should task appear?)
 * - Task expiration logic (when does task expire?)
 * - Task completion validation
 * - Priority calculation
 */

const { format, parseISO, isAfter, isBefore, startOfDay, endOfDay } = require('date-fns');

/**
 * Determine if a task should be visible to user right now
 * 
 * Rules:
 * 1. Task date must be today
 * 2. Current time must be >= window start time
 * 3. Task status must be 'pending'
 * 
 * @param {Object} task - Task object from database
 * @param {Date} currentDateTime - Current timestamp
 * @returns {boolean} - True if task should be visible
 */
function isTaskVisible(task, currentDateTime) {
  const currentDate = format(currentDateTime, 'yyyy-MM-dd');
  const currentTime = format(currentDateTime, 'HH:mm:ss');
  const taskDate = format(parseISO(task.task_date), 'yyyy-MM-dd');
  
  // Task must be for today
  if (taskDate !== currentDate) {
    return false;
  }
  
  // Task must be pending
  if (task.status !== 'pending') {
    return false;
  }
  
  // Current time must be past window start
  if (currentTime < task.window_start) {
    return false;
  }
  
  return true;
}

/**
 * Determine if a task should expire (be marked as missed)
 * 
 * Rule: Tasks expire at end of day (midnight) if still pending
 * 
 * @param {Object} task - Task object from database
 * @param {Date} currentDateTime - Current timestamp
 * @returns {boolean} - True if task should be marked as missed
 */
function shouldTaskExpire(task, currentDateTime) {
  const taskDate = parseISO(task.task_date);
  const taskEndOfDay = endOfDay(taskDate);
  
  // Task expires if:
  // 1. Status is still pending
  // 2. Current time is past end of task date
  return task.status === 'pending' && isAfter(currentDateTime, taskEndOfDay);
}

/**
 * Determine if notification should be sent for this task
 * 
 * Rules:
 * 1. Notification not already sent
 * 2. Current time matches window start time (within 1 minute)
 * 3. Task is for today
 * 
 * @param {Object} task - Task object
 * @param {Date} currentDateTime - Current timestamp
 * @returns {boolean} - True if notification should be sent
 */
function shouldSendNotification(task, currentDateTime) {
  // Already sent
  if (task.notification_sent) {
    return false;
  }
  
  const currentDate = format(currentDateTime, 'yyyy-MM-dd');
  const taskDate = format(parseISO(task.task_date), 'yyyy-MM-dd');
  
  // Must be today's task
  if (taskDate !== currentDate) {
    return false;
  }
  
  const currentTime = format(currentDateTime, 'HH:mm');
  const windowStartTime = task.window_start.substring(0, 5); // 'HH:mm'
  
  // Current time should match window start (within minute precision)
  return currentTime === windowStartTime;
}

/**
 * Calculate task priority based on type and time proximity
 * 
 * @param {string} taskType - Type of task
 * @param {Date} currentDateTime - Current time
 * @param {string} windowEnd - Window end time (HH:mm:ss)
 * @returns {string} - 'high', 'medium', or 'low'
 */
function calculateTaskPriority(taskType, currentDateTime, windowEnd) {
  // Weight is always high priority
  if (taskType === 'weight') {
    return 'high';
  }
  
  // Check time remaining in window
  const currentTime = format(currentDateTime, 'HH:mm:ss');
  const minutesRemaining = getMinutesDifference(currentTime, windowEnd);
  
  // Less than 30 minutes remaining - high priority
  if (minutesRemaining < 30) {
    return 'high';
  }
  
  // Less than 2 hours remaining - medium priority
  if (minutesRemaining < 120) {
    return 'medium';
  }
  
  // Plenty of time - low priority
  return 'low';
}

/**
 * Get minutes difference between two time strings
 * 
 * @param {string} time1 - Time in HH:mm:ss format
 * @param {string} time2 - Time in HH:mm:ss format
 * @returns {number} - Minutes difference
 */
function getMinutesDifference(time1, time2) {
  const [h1, m1] = time1.split(':').map(Number);
  const [h2, m2] = time2.split(':').map(Number);
  const minutes1 = h1 * 60 + m1;
  const minutes2 = h2 * 60 + m2;
  return minutes2 - minutes1;
}

/**
 * Validate task completion data based on task type
 * 
 * @param {string} taskType - Type of task
 * @param {Object} completionData - Data provided by user
 * @returns {Object} - { valid: boolean, error?: string }
 */
function validateTaskCompletion(taskType, completionData) {
  if (!completionData) {
    return { valid: false, error: 'Completion data is required' };
  }
  
  switch (taskType) {
    case 'weight':
      if (!completionData.weight) {
        return { valid: false, error: 'Weight value is required' };
      }
      if (typeof completionData.weight !== 'number' || completionData.weight <= 0) {
        return { valid: false, error: 'Weight must be a positive number' };
      }
      return { valid: true };
      
    case 'breakfast':
    case 'lunch':
    case 'dinner':
      if (!completionData.foodData) {
        return { valid: false, error: 'Food data is required' };
      }
      return { valid: true };
      
    case 'education':
      if (!completionData.activity) {
        return { valid: false, error: 'Education activity is required' };
      }
      return { valid: true };
      
    case 'water':
      if (!completionData.amount) {
        return { valid: false, error: 'Water amount is required' };
      }
      return { valid: true };
      
    default:
      return { valid: false, error: 'Unknown task type' };
  }
}

/**
 * Get user-friendly task title
 * 
 * @param {string} taskType - Type of task
 * @returns {string} - Human-readable title
 */
function getTaskTitle(taskType) {
  const titles = {
    weight: 'Log Morning Weight',
    breakfast: 'Log Breakfast',
    lunch: 'Log Lunch',
    dinner: 'Log Dinner',
    education: 'Log Education Activity',
    water: 'Track Water Intake'
  };
  return titles[taskType] || 'Complete Task';
}

/**
 * Get task icon emoji
 * 
 * @param {string} taskType - Type of task
 * @returns {string} - Emoji icon
 */
function getTaskIcon(taskType) {
  const icons = {
    weight: '⚖️',
    breakfast: '🍳',
    lunch: '🍽️',
    dinner: '🌙',
    education: '📚',
    water: '💧'
  };
  return icons[taskType] || '📋';
}

module.exports = {
  isTaskVisible,
  shouldTaskExpire,
  shouldSendNotification,
  calculateTaskPriority,
  validateTaskCompletion,
  getTaskTitle,
  getTaskIcon,
  getMinutesDifference
};
