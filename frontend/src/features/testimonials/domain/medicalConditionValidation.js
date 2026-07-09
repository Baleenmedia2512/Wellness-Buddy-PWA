/**
 * medicalConditionValidation.js — pure validation for medical condition input.
 */

export const MEDICAL_CONDITION_MAX_LENGTH = 100;

const ALLOWED_PATTERN = /^[a-zA-Z0-9\s\-',./()]+$/;

/**
 * @param {string} raw
 * @returns {{ valid: boolean, value: string, message: string }}
 */
export function validateMedicalCondition(raw) {
  const value = (raw ?? '').trim();

  if (!value) {
    return { valid: false, value: '', message: 'Please enter your medical condition.' };
  }

  if (value.length > MEDICAL_CONDITION_MAX_LENGTH) {
    return {
      valid: false,
      value,
      message: `Medical condition must be ${MEDICAL_CONDITION_MAX_LENGTH} characters or fewer.`,
    };
  }

  if (!ALLOWED_PATTERN.test(value)) {
    return {
      valid: false,
      value,
      message: 'Only letters, numbers, spaces, and - \' , . / ( ) are allowed.',
    };
  }

  return { valid: true, value, message: '' };
}
