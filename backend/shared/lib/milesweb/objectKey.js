/**
 * Relative keys stored in MySQL and written under wellnessvalley/uploads.
 * Folder names match the cPanel directories already created.
 */
const UPLOAD_FOLDERS = new Set([
  'avatars',
  'captures',
  'education',
  'food',
  'good-habits',
  'transformation',
  'weight',
]);

const SEGMENT = /^[A-Za-z0-9._-]+$/;

export function isAllowedUploadKey(key) {
  if (typeof key !== 'string' || key.length > 240) return false;
  if (key.includes('..') || key.includes('\\') || key.startsWith('/')) return false;
  const parts = key.split('/');
  if (parts.length < 2 || !UPLOAD_FOLDERS.has(parts[0])) return false;
  return parts.every((part) => SEGMENT.test(part));
}

export function mileswebRedirectUrl(key, env = process.env) {
  if (!isAllowedUploadKey(key)) return null;
  const base = String(env.MILESWEB_PUBLIC_UPLOAD_BASE || '').trim().replace(/\/+$/, '');
  const encoded = key.split('/').map(encodeURIComponent).join('/');
  if (base) return `${base}/${encoded}`;
  return `/api/media/${encoded}`;
}

export function isMileswebServedUrl(url, env = process.env) {
  if (typeof url !== 'string' || !url) return false;
  if (url.startsWith('/api/media/')) return true;
  const base = String(env.MILESWEB_PUBLIC_UPLOAD_BASE || '').trim().replace(/\/+$/, '');
  return Boolean(base && (url === base || url.startsWith(`${base}/`)));
}
