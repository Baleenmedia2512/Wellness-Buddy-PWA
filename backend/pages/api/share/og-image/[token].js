/**
 * GET /api/share/og-image/[token]
 *
 * Public endpoint that serves the food photo stored as ImageBase64 in
 * captures_table. Used exclusively as the og:image URL for the share
 * landing page so WhatsApp / Telegram crawlers can display the actual
 * meal photo in the link-preview card.
 *
 * Security notes:
 *  - No auth required (the URL itself is the capability token).
 *  - The token is validated against a strict UUID pattern before any DB call.
 *  - Only image bytes are returned — no user data is exposed.
 *  - The response is cached at the CDN edge for 24 h (images are immutable
 *    once written).
 */

import { findByToken } from '../../../../features/captures/data/captures.repository.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).end();
  }

  const token = (req.query.token || '').toString().trim();
  if (!UUID_RE.test(token)) {
    return res.status(400).end();
  }

  // Instant-share race: the frontend fires the share sheet before the
  // POST /captures round-trip completes. WhatsApp crawls the og-image URL
  // within 1–4 seconds of the share. We poll for up to 4 s (8 × 500 ms)
  // so the image is available by the time the crawler arrives.
  const RETRIES = 8;
  const RETRY_DELAY_MS = 500;
  let capture = null;
  for (let attempt = 0; attempt < RETRIES; attempt++) {
    try {
      capture = await findByToken(token);
    } catch {
      return res.status(500).end();
    }
    if (capture?.ImageBase64) break;
    if (attempt < RETRIES - 1) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }

  if (!capture?.ImageBase64) {
    return res.status(404).end();
  }

  // ImageBase64 may be stored as a full data URL or as raw base64.
  let mimeType = 'image/jpeg';
  let rawBase64 = capture.ImageBase64;

  if (rawBase64.startsWith('data:')) {
    const semi = rawBase64.indexOf(';');
    const comma = rawBase64.indexOf(',');
    if (semi > 0 && comma > semi) {
      mimeType = rawBase64.substring(5, semi);
      rawBase64 = rawBase64.substring(comma + 1);
    }
  }

  let imageBuffer;
  try {
    imageBuffer = Buffer.from(rawBase64, 'base64');
  } catch {
    return res.status(500).end();
  }

  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Length', imageBuffer.length);
  // Immutable — the capture image never changes after creation.
  res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
  return res.status(200).send(imageBuffer);
}
