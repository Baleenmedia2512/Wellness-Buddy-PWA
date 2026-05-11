/**
 * Thin handler wrapper. Sets CORS headers, returns true if request was preflight.
 */
export function applyCors(req, res, methods = 'GET, POST, OPTIONS') {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, cache-control, pragma');
  if (req.method === 'OPTIONS') { res.status(200).end(); return true; }
  return false;
}

export function methodNotAllowed(res) {
  return res.status(405).json({ message: 'Method not allowed' });
}

/**
 * Wrap a service call. Catches ValidationError → status/message. Catches all
 * other errors → 500.
 */
export async function runService(res, fn) {
  try {
    const { httpStatus, body, headers } = await fn();
    if (headers) {
      Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
    }
    return res.status(httpStatus).json(body);
  } catch (err) {
    if (err && err.status) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    console.error('[handler] Unhandled error:', err);
    return res.status(500).json({ success: false, message: err?.message || 'Internal server error' });
  }
}
