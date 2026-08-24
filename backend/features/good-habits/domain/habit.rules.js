/**
 * Pure Good Habit rules. No I/O.
 */

export const HABIT_TYPE_BEFORE_AFTER = 'before_after';
export const HABIT_TYPE_IMAGE_NOTES = 'image_notes';

export const HABIT_TYPES = Object.freeze([
  HABIT_TYPE_BEFORE_AFTER,
  HABIT_TYPE_IMAGE_NOTES,
]);

export const NOTES_MAX_LEN = 200;

export function isHabitType(value) {
  return HABIT_TYPES.includes(value);
}

export function clampNotes(value) {
  if (value == null) return '';
  return String(value).slice(0, NOTES_MAX_LEN);
}

export function stripDataUrl(value) {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  const comma = text.indexOf(',');
  if (text.startsWith('data:') && comma !== -1) {
    return text.slice(comma + 1) || null;
  }
  return text;
}

/**
 * @param {{ habitType: string, notes?: string, imageBase64?: string|null, beforeImageBase64?: string|null, afterImageBase64?: string|null }} input
 * @returns {{ habitType: string, notes: string, imageBase64: string|null, beforeImageBase64: string|null, afterImageBase64: string|null }}
 */
export function normalizeHabitPayload(input) {
  const habitType = input?.habitType;
  const notes = clampNotes(input?.notes);
  const imageBase64 = stripDataUrl(input?.imageBase64);
  const beforeImageBase64 = stripDataUrl(input?.beforeImageBase64);
  const afterImageBase64 = stripDataUrl(input?.afterImageBase64);

  if (habitType === HABIT_TYPE_BEFORE_AFTER) {
    return {
      habitType,
      notes,
      imageBase64: afterImageBase64 || imageBase64,
      beforeImageBase64,
      afterImageBase64,
    };
  }

  return {
    habitType,
    notes,
    imageBase64: imageBase64 || afterImageBase64 || beforeImageBase64,
    beforeImageBase64: null,
    afterImageBase64: null,
  };
}

export function assertHabitImages(normalized) {
  if (normalized.habitType === HABIT_TYPE_BEFORE_AFTER) {
    if (!normalized.beforeImageBase64 || !normalized.afterImageBase64) {
      const err = new Error('Before and After images are required');
      err.status = 400;
      err.code = 'HABIT_IMAGES_REQUIRED';
      throw err;
    }
    return;
  }
  if (!normalized.imageBase64) {
    const err = new Error('An image is required');
    err.status = 400;
    err.code = 'HABIT_IMAGE_REQUIRED';
    throw err;
  }
}

function firstNonEmpty(row, names) {
  if (!row) return null;
  for (const name of names) {
    const value = row[name];
    if (value != null && String(value).trim() !== '') return value;
  }
  const wanted = new Set(names.map((n) => String(n).toLowerCase().replace(/"/g, '')));
  for (const [key, value] of Object.entries(row)) {
    if (!wanted.has(String(key).toLowerCase().replace(/"/g, ''))) continue;
    if (value != null && String(value).trim() !== '') return value;
  }
  return null;
}

/** Map a good_habits image row to API fields regardless of PostgREST key casing. */
export function readHabitImageRow(row) {
  const imageBase64 = firstNonEmpty(row, ['ImageBase64', 'imageBase64']);
  const beforeImageBase64 = firstNonEmpty(row, ['BeforeImageBase64', 'beforeImageBase64']);
  const afterImageBase64 = firstNonEmpty(row, ['AfterImageBase64', 'afterImageBase64'])
    || imageBase64;
  return {
    imageBase64: imageBase64 || afterImageBase64 || beforeImageBase64 || null,
    beforeImageBase64: beforeImageBase64 || null,
    afterImageBase64: afterImageBase64 || null,
  };
}
