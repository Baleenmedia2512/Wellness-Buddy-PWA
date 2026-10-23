/**
 * GET /api/testimonials/file?path=&exp=&sig=
 * Serves a testimonial photo or video saved on this machine.
 */
import { applyCors, methodNotAllowed } from '../../../shared/lib/handler.js';
import {
  readTestimonialFile,
  verifyTestimonialFileRequest,
} from '../../../shared/lib/testimonial-files/localFileStorage.js';

const CONTENT_TYPES = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  json: 'application/json',
  mp4: 'video/mp4',
  webm: 'video/webm',
  part: 'application/octet-stream',
};

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (req.method !== 'GET') return methodNotAllowed(res);

  const filePath = String(req.query.path || '');
  const expiresAtMs = Number(req.query.exp);
  const signature = String(req.query.sig || '');
  if (!verifyTestimonialFileRequest(filePath, expiresAtMs, signature)) {
    return res.status(404).end();
  }

  const bytes = await readTestimonialFile(filePath);
  if (!bytes) return res.status(404).end();

  const ext = filePath.slice(filePath.lastIndexOf('.') + 1).toLowerCase();
  res.setHeader('Content-Type', CONTENT_TYPES[ext] || 'application/octet-stream');
  res.setHeader('Cache-Control', 'private, max-age=300');
  return res.status(200).send(bytes);
}
