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

import { format, parseISO, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';
import { getISTPartsFromDate } from './completion-learning.rules.js';

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
  const { date: currentDate, time: currentTime } = getISTPartsFromDate(currentDateTime);
  const taskDate = format(parseISO(task.task_date), 'yyyy-MM-dd');
  
  // Task must be for today
  if (taskDate !== currentDate) {
    return false;
  }
  
  // Task must be pending
  if (task.status !== 'pending') {
    return false;
  }
  
  // Current time must be past window start (IST)
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

// ─── Snooze / dismiss / reminder helpers ────────────────────────────────────

/** Maximum number of reminder notifications per task per day. */
const MAX_DAILY_REMINDERS = 2;

/** Allowed snooze durations in minutes. */
const VALID_SNOOZE_MINUTES = [5, 10];

/**
 * Return true when the current time falls inside the task's activity window.
 *
 * Example (Weight window 03:00 – 07:30):
 *   05:00 → true   (inside)
 *   07:45 → false  (window closed)
 *   02:55 → false  (window not open yet)
 *
 * This must be checked before sending ANY reminder so we never notify
 * outside the configured activity_time_windows_table range.
 *
 * @param {Object} task          - Task row (window_start / window_end as 'HH:mm:ss').
 * @param {Date}   currentDateTime - Injected clock.
 * @returns {boolean}
 */
function isWithinTaskWindow(task, currentDateTime) {
  const { time: currentTime } = getISTPartsFromDate(currentDateTime);
  return currentTime >= task.window_start && currentTime <= task.window_end;
}

/**
 * Determine whether a follow-up reminder should fire for a task.
 *
 * Rules:
 * 1. Task must still be pending.
 * 2. User must NOT have dismissed reminders for today.
 * 3. Reminder count must be < MAX_DAILY_REMINDERS (2 per day).
 * 4. If SnoozedUntil is set, current time must have passed it.
 * 5. Task must not have been completed.
 *
 * @param {Object} task          - Task row from DB (snake_case aliases).
 * @param {Date}   currentDateTime - Injected clock; never call Date.now() directly.
 * @returns {boolean}
 */
function shouldTriggerReminder(task, currentDateTime) {
  if (task.status !== 'pending') return false;
  if (task.reminder_dismissed_today === true) return false;
  if ((task.reminder_count ?? 0) >= MAX_DAILY_REMINDERS) return false;

  // If snooze is active, wait until it expires
  if (task.snoozed_until) {
    const snoozeExpiry = new Date(task.snoozed_until);
    if (currentDateTime < snoozeExpiry) return false;
  }

  return true;
}

/**
 * Calculate the timestamp at which a snooze period expires.
 *
 * @param {number} snoozeMinutes  - Must be one of VALID_SNOOZE_MINUTES.
 * @param {Date}   currentDateTime - Injected clock.
 * @returns {Date} - Expiry timestamp.
 * @throws {Error} - If snoozeMinutes is not a valid option.
 */
function calculateSnoozeExpiry(snoozeMinutes, currentDateTime) {
  if (!VALID_SNOOZE_MINUTES.includes(snoozeMinutes)) {
    throw new Error(
      `Invalid snooze duration: ${snoozeMinutes}. Must be one of ${VALID_SNOOZE_MINUTES.join(', ')}.`
    );
  }
  const expiry = new Date(currentDateTime.getTime() + snoozeMinutes * 60 * 1000);
  return expiry;
}

/**
 * Return true when the user has dismissed reminders for this task today.
 *
 * @param {Object} task - Task row from DB.
 * @returns {boolean}
 */
function isDismissedToday(task) {
  return task.reminder_dismissed_today === true;
}

/**
 * Return true when the task is currently within an active snooze period.
 *
 * @param {Object} task          - Task row from DB.
 * @param {Date}   currentDateTime - Injected clock.
 * @returns {boolean}
 */
function isSnoozedNow(task, currentDateTime) {
  if (!task.snoozed_until) return false;
  return currentDateTime < new Date(task.snoozed_until);
}

export {
  isTaskVisible,
  shouldTaskExpire,
  shouldSendNotification,
  calculateTaskPriority,
  validateTaskCompletion,
  getTaskTitle,
  getTaskIcon,
  getMinutesDifference,
  // reminder helpers
  shouldTriggerReminder,
  calculateSnoozeExpiry,
  isDismissedToday,
  isSnoozedNow,
  isWithinTaskWindow,
  MAX_DAILY_REMINDERS,
  VALID_SNOOZE_MINUTES
};
