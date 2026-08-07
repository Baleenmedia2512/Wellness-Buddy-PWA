/**
 * Extract client IP / User-Agent from an HTTP request for audit fields.
 * IP is taken only from the request (never trust a client-posted IP).
 */

const MAX_DEVICE_INFO = 500;
const MAX_IP = 64;

/**
 * @param {import('http').IncomingMessage} req
 * @returns {string|null}
 */
export function extractClientIp(req) {
  if (!req || !req.headers) return null;
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    // First hop is the original client on Vercel / typical proxies.
    const first = forwarded.split(',')[0].trim();
    if (first) return first.slice(0, MAX_IP);
  }
  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) {
    return realIp.trim().slice(0, MAX_IP);
  }
  const remote = req.socket?.remoteAddress || req.connection?.remoteAddress || null;
  if (!remote) return null;
  return String(remote).slice(0, MAX_IP);
}

/**
 * @param {import('http').IncomingMessage} req
 * @returns {string|null}
 */
export function extractUserAgent(req) {
  if (!req || !req.headers) return null;
  const ua = req.headers['user-agent'];
  if (typeof ua !== 'string' || !ua.trim()) return null;
  return ua.trim().slice(0, MAX_DEVICE_INFO);
}

/**
 * Merge optional client device hint with request User-Agent.
 * @param {import('http').IncomingMessage} req
 * @param {string} [clientDeviceInfo]
 * @returns {string|null}
 */
export function buildConsentDeviceInfo(req, clientDeviceInfo) {
  const ua = extractUserAgent(req);
  const client = typeof clientDeviceInfo === 'string' ? clientDeviceInfo.trim() : '';
  if (client && ua) {
    if (ua.includes(client) || client.includes(ua)) {
      return client.slice(0, MAX_DEVICE_INFO);
    }
    return `${client} | ${ua}`.slice(0, MAX_DEVICE_INFO);
  }
  if (client) return client.slice(0, MAX_DEVICE_INFO);
  return ua;
}
