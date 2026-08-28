/**
 * Static pose guidance copy for transformation photo tabs (no ML).
 * Keys match transformation_photos JSON: front | left | right
 * Tab order is Left → Centre → Right (first slot is left).
 */

export const POSE_TAB_GUIDE = Object.freeze({
  left: {
    label: 'Left',
    tip: 'Turn LEFT — full body, head to feet',
  },
  front: {
    label: 'Centre',
    tip: 'Face the camera — face clear in frame',
  },
  right: {
    label: 'Right',
    tip: 'Turn RIGHT — full body, head to feet',
  },
});

export const POSE_SLOT_KEYS = Object.freeze(['left', 'front', 'right']);
export const DEFAULT_POSE_SLOT = 'left';

/**
 * Left tab guide faces screen-left (Turn LEFT).
 * Right tab guide faces screen-right (Turn RIGHT).
 * @param {'front'|'left'|'right'} poseType
 */
export function poseFacesScreenRight(poseType) {
  return poseType === 'right';
}

/**
 * @param {{ front?: string|null, left?: string|null, right?: string|null }} previews
 */
export function allTransformationSlotsFilled(previews = {}) {
  return POSE_SLOT_KEYS.every((key) => {
    const value = previews?.[key];
    return typeof value === 'string' && value.trim().length > 0;
  });
}

/**
 * @param {{ front?: string|null, left?: string|null, right?: string|null }} previews
 * @param {'front'|'left'|'right'} current
 */
export function nextEmptyTransformationSlot(previews = {}, current = DEFAULT_POSE_SLOT) {
  const start = Math.max(0, POSE_SLOT_KEYS.indexOf(current));
  for (let i = 1; i <= POSE_SLOT_KEYS.length; i += 1) {
    const key = POSE_SLOT_KEYS[(start + i) % POSE_SLOT_KEYS.length];
    const value = previews?.[key];
    if (!(typeof value === 'string' && value.trim().length > 0)) return key;
  }
  return null;
}
