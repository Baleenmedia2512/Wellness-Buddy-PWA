/**
 * GET /api/media/food/42/99/ab.jpg
 * Streams a file saved under wellnessvalley/uploads. Old R2 photos never hit this route
 * unless that exact key was uploaded here.
 */
import { applyCors, methodNotAllowed } from '../../../shared/lib/handler.js';
import { isAllowedUploadKey } from '../../../shared/lib/milesweb/objectKey.js';
import { readMileswebObject } from '../../../shared/lib/milesweb/ftpStorage.js';

const CONTENT_TYPES = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
};

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (req.method !== 'GET') return methodNotAllowed(res);

  const parts = Array.isArray(req.query.key) ? req.query.key : [];
  const key = parts.map((part) => {
    try {
      return decodeURIComponent(part);
    } catch {
      return part;
    }
  }).join('/');

  if (!isAllowedUploadKey(key)) return res.status(404).end();

  const bytes = await readMileswebObject(key);
  if (!bytes) return res.status(404).end();

  const ext = key.slice(key.lastIndexOf('.') + 1).toLowerCase();
  res.setHeader('Content-Type', CONTENT_TYPES[ext] || 'application/octet-stream');
  res.setHeader('Cache-Control', 'private, max-age=3600');
  return res.status(200).send(bytes);
}
