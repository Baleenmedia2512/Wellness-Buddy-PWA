/**
 * Remember a skip for this visit so the screen can close.
 * The next time the app is opened, an empty field can be asked again.
 */

function storageKey(userId) {
  return `fieldCollectionDefer:${userId}`;
}

export function readDeferredFields(userId) {
  if (userId == null || typeof sessionStorage === 'undefined') return [];
  try {
    const parsed = JSON.parse(sessionStorage.getItem(storageKey(userId)) || '[]');
    return Array.isArray(parsed) ? parsed.filter((key) => typeof key === 'string') : [];
  } catch {
    return [];
  }
}

export function deferFieldForSession(userId, fieldKey) {
  if (userId == null || !fieldKey || typeof sessionStorage === 'undefined') return;
  const list = readDeferredFields(userId);
  if (list.includes(fieldKey)) return;
  list.push(fieldKey);
  sessionStorage.setItem(storageKey(userId), JSON.stringify(list));
}
