/**
 * R2 object-key layout — one bucket, one folder per image type.
 *
 * Do not put files at the bucket root. Later slices (food, transformation,
 * weight, captures) must use their own prefix so avatars stay isolated
 * (public GET vs private signed URLs).
 */
export const R2_FOLDERS = Object.freeze({
  avatar: 'avatars',
  transformation: 'transformation',
  food: 'food',
  captures: 'captures',
  weight: 'weight',
  education: 'education',
  goodHabit: 'good-habits',
});

function safeSegment(value) {
  const raw = String(value ?? '').trim();
  if (!raw || raw.includes('/') || raw.includes('..')) {
    throw new Error('Invalid R2 key segment');
  }
  return raw;
}

function joinKey(folder, ...parts) {
  return [folder, ...parts.map(safeSegment)].join('/');
}

/** Custom profile photo. Example: avatars/42/ab12cd.jpg */
export function buildAvatarObjectKey(userId, contentHash, ext = 'jpg') {
  return joinKey(R2_FOLDERS.avatar, userId, `${safeSegment(contentHash)}.${safeSegment(ext)}`);
}

/** Profile transformation slots: front | left | right. */
export function buildTransformationObjectKey(userId, slot, contentHash, ext = 'jpg') {
  return joinKey(
    R2_FOLDERS.transformation,
    userId,
    safeSegment(slot),
    `${safeSegment(contentHash)}.${safeSegment(ext)}`,
  );
}

/** Meal / food diary photo. */
export function buildFoodObjectKey(userId, mealId, contentHash, ext = 'jpg') {
  return joinKey(
    R2_FOLDERS.food,
    userId,
    mealId,
    `${safeSegment(contentHash)}.${safeSegment(ext)}`,
  );
}

/** Scale photo. Example: weight/42/99/ab12cd.jpg */
export function buildWeightObjectKey(userId, recordId, contentHash, ext = 'jpg') {
  return joinKey(
    R2_FOLDERS.weight,
    userId,
    recordId,
    `${safeSegment(contentHash)}.${safeSegment(ext)}`,
  );
}

/** Education log photo. Example: education/42/99/ab12cd.jpg */
export function buildEducationObjectKey(userId, logId, contentHash, ext = 'jpg') {
  return joinKey(
    R2_FOLDERS.education,
    userId,
    logId,
    `${safeSegment(contentHash)}.${safeSegment(ext)}`,
  );
}

/** Good-habit slot: main | before | after. */
export function buildGoodHabitObjectKey(userId, habitId, slot, contentHash, ext = 'jpg') {
  return joinKey(
    R2_FOLDERS.goodHabit,
    userId,
    habitId,
    safeSegment(slot),
    `${safeSegment(contentHash)}.${safeSegment(ext)}`,
  );
}

export function isKeyInFolder(key, folder) {
  const prefix = `${folder}/`;
  return typeof key === 'string' && key.startsWith(prefix) && !key.includes('..');
}

/**
 * Avatar objects that are in the bucket but not the live ProfileImageKey.
 * Only `avatars/{userId}/{file}` — never food/transformation/etc.
 *
 * @param {string[]} listedKeys
 * @param {Iterable<string>} liveKeys
 * @returns {string[]}
 */
export function orphanedAvatarKeys(listedKeys, liveKeys) {
  const live = new Set(
    [...(liveKeys || [])].filter((k) => typeof k === 'string' && k.length > 0),
  );
  const listed = Array.isArray(listedKeys) ? listedKeys : [];
  const orphans = [];
  for (const key of listed) {
    if (typeof key !== 'string' || key.includes('..')) continue;
    if (!isKeyInFolder(key, R2_FOLDERS.avatar)) continue;
    const parts = key.split('/');
    if (parts.length !== 3 || parts[0] !== R2_FOLDERS.avatar) continue;
    if (live.has(key)) continue;
    orphans.push(key);
  }
  return orphans;
}
