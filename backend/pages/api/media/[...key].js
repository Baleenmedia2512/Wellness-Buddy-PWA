/**
 * GET /api/media/food/42/99/ab.jpg
 * Streams a file saved under wellnessvalley/uploads. Old R2 photos never hit this route
 * unless that exact key was uploaded here.
 *
 * Videos need a correct Content-Type and Accept-Ranges / 206 for <video> playback.
 */
import { applyCors, methodNotAllowed } from '../../../shared/lib/handler.js';
import { rejectIfMandatoryProfileBlocks } from '../../../features/mandatory-fields/api/enforce.handler.js';
import { isAllowedUploadKey } from '../../../shared/lib/milesweb/objectKey.js';
import { readMileswebObject } from '../../../shared/lib/milesweb/ftpStorage.js';

const CONTENT_TYPES = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  mp4: 'video/mp4',
  m4v: 'video/x-m4v',
  webm: 'video/webm',
  mov: 'video/quicktime',
};

function parseRange(rangeHeader, size) {
  const match = /^bytes=(\d*)-(\d*)$/i.exec(String(rangeHeader || '').trim());
  if (!match) return null;
  const startRaw = match[1];
  const endRaw = match[2];
  if (!startRaw && !endRaw) return null;
  let start;
  let end;
  if (!startRaw) {
    // suffix: bytes=-500 → last 500 bytes
    const suffix = Number(endRaw);
    if (!Number.isFinite(suffix) || suffix <= 0) return null;
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(startRaw);
    end = endRaw ? Number(endRaw) : size - 1;
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start || start >= size) {
    return null;
  }
  return { start, end: Math.min(end, size - 1) };
}

export default async function handler(req, res) {
  if (await rejectIfMandatoryProfileBlocks(req, res)) return;
  if (applyCors(req, res, 'GET, HEAD, OPTIONS')) return;
  if (req.method !== 'GET' && req.method !== 'HEAD') return methodNotAllowed(res);

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
  const contentType = CONTENT_TYPES[ext] || 'application/octet-stream';
  const size = bytes.length;
  const isVideo = contentType.startsWith('video/');

  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', isVideo ? 'private, max-age=3600' : 'private, max-age=3600');
  res.setHeader('Accept-Ranges', 'bytes');

  const range = parseRange(req.headers.range, size);
  if (range) {
    const { start, end } = range;
    const chunk = bytes.subarray(start, end + 1);
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
    res.setHeader('Content-Length', String(chunk.length));
    if (req.method === 'HEAD') return res.end();
    return res.end(chunk);
  }

  if (req.headers.range) {
    // Malformed / unsatisfiable range
    res.setHeader('Content-Range', `bytes */${size}`);
    return res.status(416).end();
  }

  res.setHeader('Content-Length', String(size));
  if (req.method === 'HEAD') return res.status(200).end();
  return res.status(200).send(bytes);
}
