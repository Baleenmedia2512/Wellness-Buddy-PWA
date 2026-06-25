/**
 * snooze-task.schema.js — Validation for snooze and dismiss endpoints
 *
 * Per claude.md §3.2: Validation lives in validation/
 * Per claude.md §2.6: Every endpoint MUST validate input with a schema
 */

import { VALID_SNOOZE_MINUTES } from '../domain/task-rules.js';

/**
 * Validate POST /api/tasks/snooze request body.
 *
 * @param {Object} body - { taskId, snoozeMinutes }
 * @returns {{ valid: boolean, errors?: string[] }}
 */
function validateSnoozeRequest(body) {
  const errors = [];

  if (!body.taskId && body.taskId !== 0) {
    errors.push('taskId is required');
  } else if (typeof body.taskId !== 'number' || body.taskId <= 0) {
    errors.push('taskId must be a positive number');
  }

  if (!body.snoozeMinutes) {
    errors.push('snoozeMinutes is required');
  } else if (!VALID_SNOOZE_MINUTES.includes(body.snoozeMinutes)) {
    errors.push(`snoozeMinutes must be one of: ${VALID_SNOOZE_MINUTES.join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
}

/**
 * Validate POST /api/tasks/dismiss request body.
 *
 * @param {Object} body - { taskId }
 * @returns {{ valid: boolean, errors?: string[] }}
 */
function validateDismissRequest(body) {
  const errors = [];

  if (!body.taskId && body.taskId !== 0) {
    errors.push('taskId is required');
  } else if (typeof body.taskId !== 'number' || body.taskId <= 0) {
    errors.push('taskId must be a positive number');
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
}

export { validateSnoozeRequest, validateDismissRequest };
