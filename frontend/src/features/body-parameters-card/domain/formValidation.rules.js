/**
 * formValidation.rules.js — BCM form required + dependent-field prompts.
 * Pure. Used so range checks do not wait silently until a parent field is filled.
 */

export const BCM_REQUIRED_FIELDS = ['name', 'phoneNumber'];

/** Dependent metric → parent field that must be filled first. */
export const BCM_DEPENDENT_PARENTS = {
  fatPercent: { parent: 'gender', label: 'Fat%' },
  chestCm: { parent: 'gender', label: 'Chest' },
  waistCm: { parent: 'gender', label: 'Waist' },
  hipCm: { parent: 'gender', label: 'Hip' },
  weightKg: { parent: 'heightCm', label: 'Weight' },
  bodyAge: { parent: 'age', label: 'Body Age' },
};

function filled(val) {
  return val != null && String(val).trim() !== '';
}

export function isValidBcmHeight(heightCm) {
  const h = parseFloat(heightCm);
  return Number.isFinite(h) && h >= 50 && h <= 250;
}

export function isValidBcmGender(gender) {
  const g = String(gender || '');
  return g === 'Male' || g === 'Female';
}

export function isBcmParentFilled(parentField, form) {
  if (parentField === 'gender') return isValidBcmGender(form?.gender);
  if (parentField === 'heightCm') return isValidBcmHeight(form?.heightCm);
  if (parentField === 'age') return filled(form?.age);
  return true;
}

/**
 * @param {'name'|'phoneNumber'} field
 * @param {object} form
 * @returns {string|null}
 */
export function getBcmRequiredFieldError(field, form) {
  if (field === 'name') {
    return filled(form?.name) ? null : 'Name is required';
  }
  if (field === 'phoneNumber') {
    const raw = String(form?.phoneNumber || '').trim();
    if (!raw) return 'Phone number is required';
    const cleaned = raw.replace(/[\s\-()]/g, '');
    if (!/^\+?[0-9]{10,15}$/.test(cleaned)) {
      return 'Please enter a valid phone number (10–15 digits)';
    }
    return null;
  }
  return null;
}

/**
 * First required field the coach must fill (for scroll/focus).
 * @param {object} form
 * @returns {'name'|'phoneNumber'|null}
 */
export function getFirstMissingBcmRequiredField(form) {
  if (getBcmRequiredFieldError('name', form)) return 'name';
  if (getBcmRequiredFieldError('phoneNumber', form)) return 'phoneNumber';
  return null;
}

function parentPromptVerb(parentField) {
  if (parentField === 'gender') return 'select gender';
  if (parentField === 'heightCm') return 'enter height';
  if (parentField === 'age') return 'enter age';
  return 'complete this field';
}

function dependentLabelForParent(parentField, form, requestedFor) {
  const meta = requestedFor ? BCM_DEPENDENT_PARENTS[requestedFor] : null;
  if (meta && meta.parent === parentField) return meta.label;

  const match = Object.entries(BCM_DEPENDENT_PARENTS).find(([field, info]) => (
    info.parent === parentField && filled(form?.[field])
  ));
  return match ? match[1].label : null;
}

/**
 * Message shown on the parent field after the user opens a dependent metric.
 * @param {'heightCm'|'gender'|'age'} parentField
 * @param {object} form
 * @param {{ requestedFor?: string|null }} [opts]
 * @returns {string|null}
 */
export function getBcmParentNeededHint(parentField, form, opts = {}) {
  if (isBcmParentFilled(parentField, form)) return null;
  const label = dependentLabelForParent(parentField, form, opts.requestedFor || null);
  if (!label) return null;
  return `Please ${parentPromptVerb(parentField)} for ${label}`;
}
