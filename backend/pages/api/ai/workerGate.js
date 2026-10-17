/**
 * AI worker gate. No Gemini or job-queue imports — the route passes those in.
 * Vercel still calls /api/ai/worker every minute; this only decides whether
 * that invocation may drain jobs.
 */
import logger from '../../../shared/lib/logger.js';
import { readAiPhotoAnalysisMode } from '../../../features/ai-credits/data/ai-credits.repo.js';

export const MAX_JOBS_DEFAULT = 3;
const MAX_JOBS_LIMIT = 10;

/**
 * Supabase project this process is configured to use.
 * The worker never selects a second project URL.
 * @param {NodeJS.ProcessEnv} [env]
 */
export function workerSupabaseHost(env = process.env) {
  const raw = String(env.SUPABASE_URL || '').trim();
  if (!raw) return '';
  try {
    return new URL(raw).host;
  } catch {
    return '';
  }
}

export function isWorkerAuthorised(req) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const cronHeader = req.headers['authorization'] ?? '';
    const cronToken = cronHeader.startsWith('Bearer ') ? cronHeader.slice(7) : '';
    if (cronToken.length === cronSecret.length) {
      let diff = 0;
      for (let i = 0; i < cronToken.length; i += 1) {
        diff |= cronToken.charCodeAt(i) ^ cronSecret.charCodeAt(i);
      }
      if (diff === 0) return true;
    }
  }

  const secret = process.env.WORKER_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      return req.headers['x-vercel-cron'] === '1';
    }
    return true;
  }

  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (token.length !== secret.length) return false;
  let diff = 0;
  for (let i = 0; i < token.length; i += 1) {
    diff |= token.charCodeAt(i) ^ secret.charCodeAt(i);
  }
  return diff === 0;
}

function unknownModeResult() {
  return {
    status: 503,
    body: {
      ok: false,
      skipped: true,
      reason: 'ai_mode_unknown',
      processed: 0,
      succeeded: 0,
      failed: 0,
      error: {
        code: 'AI_MODE_UNKNOWN',
        message: 'AI photo analysis mode could not be determined',
      },
    },
  };
}

function resolveMaxJobs(req) {
  let maxJobs = MAX_JOBS_DEFAULT;
  if (req.method === 'POST' && req.body?.maxJobs) {
    const parsed = parseInt(req.body.maxJobs, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      maxJobs = Math.min(parsed, MAX_JOBS_LIMIT);
    }
  } else if (req.query?.maxJobs) {
    const parsed = parseInt(req.query.maxJobs, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      maxJobs = Math.min(parsed, MAX_JOBS_LIMIT);
    }
  }
  return maxJobs;
}

/**
 * Auth, then the admin AI Mode switch, then the existing drain.
 * A failed or indeterminate mode read does not select or modify jobs.
 *
 * @param {import('next').NextApiRequest} req
 * @param {{
 *   readMode?: typeof readAiPhotoAnalysisMode,
 *   drain?: (maxJobs: number) => Promise<{ processed: number, succeeded: number, failed: number }>,
 *   stats?: () => object,
 *   breakers?: () => object,
 * }} [deps]
 */
export async function executeAiWorker(req, deps = {}) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return {
      status: 405,
      body: {
        ok: false,
        error: { code: 'METHOD_NOT_ALLOWED', message: 'Only POST or GET allowed' },
      },
    };
  }

  if (!isWorkerAuthorised(req)) {
    logger.warn('worker: unauthorised request', {
      method: req.method,
      ip: req.headers['x-forwarded-for'] ?? 'unknown',
    });
    return {
      status: 401,
      body: {
        ok: false,
        error: { code: 'UNAUTHORISED', message: 'Invalid or missing worker secret' },
      },
    };
  }

  const readMode = deps.readMode || readAiPhotoAnalysisMode;
  let mode;
  try {
    mode = await readMode();
  } catch (err) {
    logger.error('worker: AI photo analysis mode unknown', {
      code: err?.code || 'AI_MODE_UNKNOWN',
    });
    return unknownModeResult();
  }

  if (!mode?.known) {
    logger.error('worker: AI photo analysis mode unknown', { reason: 'indeterminate' });
    return unknownModeResult();
  }

  if (!mode.enabled) {
    logger.info('worker: skipped because AI photo analysis is off');
    return {
      status: 200,
      body: {
        ok: true,
        skipped: true,
        reason: 'ai_photo_analysis_off',
        processed: 0,
        succeeded: 0,
        failed: 0,
      },
    };
  }

  if (typeof deps.drain !== 'function') {
    const err = new Error('AI worker drain is not configured');
    err.code = 'WORKER_MISCONFIGURED';
    throw err;
  }

  const maxJobs = resolveMaxJobs(req);
  const workerStart = Date.now();
  logger.info('worker: starting drain cycle', { maxJobs });

  try {
    const { processed, succeeded, failed } = await deps.drain(maxJobs);
    const latencyMs = Date.now() - workerStart;
    const queueStats = typeof deps.stats === 'function' ? deps.stats() : undefined;
    const breakers = typeof deps.breakers === 'function' ? deps.breakers() : undefined;

    logger.info('worker: drain cycle completed', {
      processed,
      succeeded,
      failed,
      latencyMs,
      queueStats,
    });

    return {
      status: 200,
      body: {
        ok: true,
        processed,
        succeeded,
        failed,
        latencyMs,
        queueStats,
        circuitBreakers: breakers,
      },
    };
  } catch (err) {
    logger.error('worker: drain cycle failed', { error: err.message });
    return {
      status: 500,
      body: {
        ok: false,
        error: { code: 'WORKER_ERROR', message: err.message },
      },
    };
  }
}
