/**
 * /api/weight-progress-tips/check
 * Check for reverse weight progress and return tips.
 * 
 * Query params:
 *   - userId (required): User ID
 *   - currentWeightId (optional): Specific weight record ID
 */
import { checkProgressHandler } from '../../../features/weight-progress-tips/api/check-progress.handler.js';
import { methodNotAllowed } from '../../../shared/lib/handler.js';
import logger from '../../../shared/lib/logger.js';

export default async function handler(req, res) {
  // Custom CORS for credentials support
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, cache-control, pragma');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'GET') return methodNotAllowed(res);

  const requestId = req.headers['x-request-id'] || Math.random().toString(36).substring(7);
  const startTime = Date.now();

  try {
    const result = await checkProgressHandler(req.query);

    logger.info('Weight progress check completed', {
      requestId,
      userId: req.query.userId,
      shouldShow: result.data.shouldShow,
      durationMs: Date.now() - startTime,
    });

    return res.status(200).json(result);
  } catch (error) {
    logger.error('Weight progress check failed', {
      requestId,
      userId: req.query.userId,
      error: error.message,
      stack: error.stack,
      durationMs: Date.now() - startTime,
    });

    // Handle validation errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message,
          details: error.details,
        },
      });
    }

    // Generic server error - include actual error in development
    return res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: process.env.NODE_ENV === 'production' 
          ? 'Failed to check weight progress'
          : `Failed to check weight progress: ${error.message}`,
        ...(process.env.NODE_ENV !== 'production' && { stack: error.stack }),
      },
    });
  }
}
