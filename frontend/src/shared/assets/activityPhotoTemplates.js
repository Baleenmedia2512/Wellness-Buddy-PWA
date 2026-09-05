/**
 * Local template photos for activity rows that have no R2 ImageKey
 * (older than the backfill window). Never use leftover Base64.
 * Profile avatars are not included — those stay letter / Google / R2.
 */
export const ACTIVITY_PHOTO_TEMPLATES = Object.freeze({
  food: '/emoji/1f37d.svg',
  weight: '/scale.png',
  education: '/education.svg',
  'good-habit': '/emoji/1f331.svg',
  unknown: '/emoji/1f4c2.svg',
  capture: '/emoji/1f4c2.svg',
});

export function activityPhotoTemplate(kind) {
  return ACTIVITY_PHOTO_TEMPLATES[kind] || ACTIVITY_PHOTO_TEMPLATES.unknown;
}

/** Swap a broken R2 <img> to the kind template. Safe if the template also 404s. */
export function handleActivityPhotoError(event, kind) {
  const img = event?.currentTarget;
  if (!img || img.dataset.templateApplied === '1') return;
  img.dataset.templateApplied = '1';
  img.src = activityPhotoTemplate(kind);
}
