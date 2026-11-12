import { writePoolMetricsLine } from './dbPoolMetricsLog.js';
import {
  createPoolMetricsStore,
  isDbPoolMetricsEnabled,
  poolMetricsSummary,
  runWithPoolMetrics,
} from './prisma.js';

/**
 * Allowed development frontend origin. Production keeps the existing `*`
 * rule (set in next.config.js headers) so cross-origin production traffic is
 * unaffected. The local dev frontend (http://localhost:3001) is reflected
 * explicitly so preflight/credentialed requests from it succeed.
 */
const DEV_FRONTEND_ORIGIN = 'http://localhost:3001';

/**
 * Thin handler wrapper. Sets CORS headers, returns true if request was preflight.
 */
export function applyCors(req, res, methods = 'GET, POST, OPTIONS') {
  const origin = String(req.headers.origin || '');
  // Reflect the exact dev origin; fall back to `*` for every other origin
  // (production on Vercel, etc.) so existing security rules are preserved.
  const allowOrigin = origin === DEV_FRONTEND_ORIGIN ? origin : '*';
  res.setHeader('Access-Control-Allow-Origin', allowOrigin);
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, cache-control, pragma, X-App-Version, X-App-Version-Code, X-App-Platform');
  if (req.method === 'OPTIONS') { res.status(200).end(); return true; }
  return false;
}

export function methodNotAllowed(res) {
  return res.status(405).json({ message: 'Method not allowed' });
}

/**
 * Wrap a service call. Catches ValidationError → status/message. Catches all
 * other errors → 500.
 * When DB_POOL_METRICS=1, each call gets its own request store and one summary
 * line. The summary records the pathname only, never the query string.
 */
export async function runService(res, fn) {
  if (!isDbPoolMetricsEnabled()) return executeService(res, fn);
  const store = createPoolMetricsStore(res?.req);
  try {
    return await runWithPoolMetrics(store, () => executeService(res, fn));
  } finally {
    writePoolMetricsLine({
      message: 'db pool metrics',
      ...poolMetricsSummary(store, res?.statusCode ?? null),
    });
  }
}

async function executeService(res, fn) {
  try {
    const req = res?.req;
    if (req) {
      const { rejectIfMandatoryProfileBlocks } = await import(
        '../../features/mandatory-fields/api/enforce.handler.js'
      );
      if (await rejectIfMandatoryProfileBlocks(req, res)) return;
    }
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
