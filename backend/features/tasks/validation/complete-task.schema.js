/**
 * complete-task.schema.js — Validation schema for task completion
 * 
 * Per claude.md §2.6: Every endpoint MUST validate input with a schema
 * Using simple validation (can upgrade to zod/joi later if needed)
 */

/**
 * Validate complete task request body
 * 
 * @param {Object} body - Request body
 * @returns {Object} - { valid: boolean, errors?: Array }
 */
function validateCompleteTaskRequest(body) {
  const errors = [];
  
  if (!body.taskId) {
    errors.push('taskId is required');
  } else if (typeof body.taskId !== 'number' || body.taskId <= 0) {
    errors.push('taskId must be a positive number');
  }
  
  if (!body.completionData) {
    errors.push('completionData is required');
  } else if (typeof body.completionData !== 'object') {
    errors.push('completionData must be an object');
  }
  
  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
}

/**
 * Validate weight completion data
 * 
 * @param {Object} data - Completion data
 * @returns {Object} - { valid: boolean, errors?: Array }
 */
function validateWeightCompletion(data) {
  const errors = [];
  
  if (!data.weight) {
    errors.push('weight is required');
  } else if (typeof data.weight !== 'number') {
    errors.push('weight must be a number');
  } else if (data.weight <= 0 || data.weight > 500) {
    errors.push('weight must be between 0 and 500 kg');
  }
  
  if (data.unit && !['kg', 'lbs'].includes(data.unit)) {
    errors.push('unit must be kg or lbs');
  }
  
  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
}

/**
 * Validate food completion data
 * 
 * @param {Object} data - Completion data
 * @returns {Object} - { valid: boolean, errors?: Array }
 */
function validateFoodCompletion(data) {
  const errors = [];
  
  if (!data.foodData) {
    errors.push('foodData is required');
  } else if (typeof data.foodData !== 'object') {
    errors.push('foodData must be an object');
  }
  
  if (data.foodData && !Array.isArray(data.foodData.items)) {
    errors.push('foodData.items must be an array');
  }
  
  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
}

/**
 * Validate education completion data
 * 
 * @param {Object} data - Completion data
 * @returns {Object} - { valid: boolean, errors?: Array }
 */
function validateEducationCompletion(data) {
  const errors = [];
  
  if (!data.activity) {
    errors.push('activity is required');
  } else if (typeof data.activity !== 'string' || data.activity.trim().length === 0) {
    errors.push('activity must be a non-empty string');
  }
  
  if (data.duration && typeof data.duration !== 'number') {
    errors.push('duration must be a number');
  }
  
  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
}

/**
 * Validate water completion data
 * 
 * @param {Object} data - Completion data
 * @returns {Object} - { valid: boolean, errors?: Array }
 */
function validateWaterCompletion(data) {
  const errors = [];
  
  if (!data.amount) {
    errors.push('amount is required');
  } else if (typeof data.amount !== 'number') {
    errors.push('amount must be a number');
  } else if (data.amount <= 0 || data.amount > 10000) {
    errors.push('amount must be between 0 and 10000 ml');
  }
  
  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
}

export {
  validateCompleteTaskRequest,
  validateWeightCompletion,
  validateFoodCompletion,
  validateEducationCompletion,
  validateWaterCompletion
};
