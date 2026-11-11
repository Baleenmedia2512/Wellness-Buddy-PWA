import { AsyncLocalStorage } from 'node:async_hooks';
import { PrismaClient } from '@prisma/client';
import logger from './logger.js';
import { writePoolMetricsLine } from './dbPoolMetricsLog.js';

const globalForPrisma = globalThis;

/**
 * Per-request Prisma counters. Staging turns this on with DB_POOL_METRICS=1.
 * Production must not set that variable. NODE_ENV is not the switch.
 * Client elapsed time includes pool wait. It is not SQL execution time.
 */
const poolMetricsStorage = new AsyncLocalStorage();

const POOL_METRICS_TIMING = 'client-elapsed-includes-pool-wait';

/** MilesWeb shared hosting has a small connection cap. Do not raise this blindly. */
export const MYSQL_POOL_DEFAULTS = {
  connection_limit: '8',
  pool_timeout: '20',
  connect_timeout: '10',
};

const TRANSIENT_CONNECTION_CODES = new Set([
  'P1001',
  'P1002',
  'P1017',
  'P2024',
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EPIPE',
  'PROTOCOL_CONNECTION_LOST',
]);

/**
 * Add Prisma pool params when the URL does not already set them.
 * Existing query keys are left unchanged so ops can override per environment.
 * @param {string} url
 * @returns {string}
 */
export function withMysqlPoolParams(url) {
  if (!url) return url;
  const question = url.indexOf('?');
  const base = question === -1 ? url : url.slice(0, question);
  const query = question === -1 ? '' : url.slice(question + 1);
  const params = new URLSearchParams(query);
  for (const [key, value] of Object.entries(MYSQL_POOL_DEFAULTS)) {
    if (!params.has(key)) params.set(key, value);
  }
  const next = params.toString();
  return next ? `${base}?${next}` : base;
}

/**
 * True only for a dropped/unreachable MySQL socket or an empty pool.
 * Unique, timeout-of-running-query, and app errors are not retried.
 * @param {unknown} err
 * @returns {boolean}
 */
export function isTransientConnectionError(err) {
  if (!err || typeof err !== 'object') return false;
  const code = String(err.code || err.meta?.code || '');
  if (TRANSIENT_CONNECTION_CODES.has(code)) return true;
  const message = String(err.message || '').toLowerCase();
  return message.includes('server has gone away')
    || message.includes('connection lost')
    || message.includes('lost connection to mysql')
    || message.includes("can't reach database")
    || message.includes('cannot reach database server')
    || message.includes('closed the connection')
    || message.includes('timed out fetching a new connection');
}

/**
 * True only when staging explicitly enables pool counters.
 * Any other value, including "true" or a production NODE_ENV, leaves them off.
 * @returns {boolean}
 */
export function isDbPoolMetricsEnabled() {
  return process.env.DB_POOL_METRICS === '1';
}

/**
 * Prisma pool-timeout class from err.code alone.
 * P2024 is the connection-pool checkout timeout.
 * P2028 is the interactive-transaction start timeout.
 * Message text and driver meta codes are ignored.
 * @param {unknown} err
 * @returns {'P2024'|'P2028'|null}
 */
export function poolTimeoutCode(err) {
  const code = err && typeof err === 'object' ? err.code : null;
  if (code === 'P2024' || code === 'P2028') return code;
  return null;
}

/**
 * Path only. Query strings can carry user ids and are never recorded.
 * @param {unknown} url
 * @returns {string|null}
 */
export function metricsRoutePath(url) {
  if (typeof url !== 'string' || url.length === 0) return null;
  const path = url.split('#')[0].split('?')[0];
  if (!path.startsWith('/')) return null;
  return path;
}

/**
 * @param {{ method?: string, url?: string }|null|undefined} req
 */
export function createPoolMetricsStore(req) {
  return {
    method: typeof req?.method === 'string' ? req.method : null,
    route: metricsRoutePath(req?.url),
    started: Date.now(),
    prismaOperationCount: 0,
    prismaClientElapsedMs: 0,
    p2024: 0,
    p2028: 0,
  };
}

/**
 * @param {ReturnType<typeof createPoolMetricsStore>} store
 * @param {number|null} status
 */
export function poolMetricsSummary(store, status) {
  return {
    pid: process.pid,
    method: store.method,
    route: store.route,
    status: status ?? null,
    wallMs: Date.now() - store.started,
    prismaOperations: store.prismaOperationCount,
    prismaClientElapsedMs: store.prismaClientElapsedMs,
    timing: POOL_METRICS_TIMING,
    p2024: store.p2024,
    p2028: store.p2028,
  };
}

/** @returns {object|null} */
export function currentPoolMetrics() {
  const store = poolMetricsStorage.getStore();
  if (!store) return null;
  return {
    method: store.method,
    route: store.route,
    prismaOperationCount: store.prismaOperationCount,
    prismaClientElapsedMs: store.prismaClientElapsedMs,
    p2024: store.p2024,
    p2028: store.p2028,
  };
}

/**
 * @template T
 * @param {ReturnType<typeof createPoolMetricsStore>} store
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
export function runWithPoolMetrics(store, fn) {
  return poolMetricsStorage.run(store, fn);
}

/**
 * Count one Prisma client operation. No-op without the flag or a request store.
 * `elapsedMs` is client elapsed time, including pool wait, not SQL time.
 * @param {number} elapsedMs
 */
export function addPrismaClientElapsed(elapsedMs) {
  if (!isDbPoolMetricsEnabled()) return;
  const store = poolMetricsStorage.getStore();
  if (!store) return;
  const ms = Number(elapsedMs);
  if (!Number.isFinite(ms) || ms < 0) return;
  store.prismaOperationCount += 1;
  store.prismaClientElapsedMs += ms;
}

/**
 * Time one client operation when metrics are on. The disabled path calls `fn` only.
 * @template T
 * @param {() => Promise<T>} fn
 * @param {() => number} [now]
 * @returns {Promise<T>}
 */
export async function measurePrismaOperation(fn, now = Date.now) {
  if (!isDbPoolMetricsEnabled()) return fn();
  const started = now();
  try {
    return await fn();
  } finally {
    addPrismaClientElapsed(now() - started);
  }
}

function notePoolTimeout(err) {
  if (!isDbPoolMetricsEnabled()) return;
  const code = poolTimeoutCode(err);
  if (!code) return;
  const store = poolMetricsStorage.getStore();
  if (!store) return;
  if (code === 'P2024') store.p2024 += 1;
  else store.p2028 += 1;
}

/**
 * Log pid once at process listen. No-op unless DB_POOL_METRICS=1.
 * @returns {boolean}
 */
export function logPoolMetricsProcessStart() {
  if (!isDbPoolMetricsEnabled()) return false;
  writePoolMetricsLine({ message: 'db pool metrics listening', pid: process.pid });
  return true;
}

/**
 * Run `fn` once more after a dropped connection. Other errors throw as-is.
 * Pool-timeout counts are taken from err.code before this retry decision.
 * @template T
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function withPrismaRetry(fn) {
  try {
    return await fn();
  } catch (err) {
    notePoolTimeout(err);
    if (!isTransientConnectionError(err)) throw err;
    logger.warn('MySQL connection lost; retrying once', { code: err.code || null });
    return fn();
  }
}

function withRetryClient(client) {
  const extended = client.$extends({
    query: {
      async $allOperations({ args, query }) {
        if (!isDbPoolMetricsEnabled()) {
          return withPrismaRetry(() => query(args));
        }
        return measurePrismaOperation(() => withPrismaRetry(() => query(args)));
      },
    },
  });
  const runTransaction = extended.$transaction.bind(extended);
  return new Proxy(extended, {
    get(target, prop, receiver) {
      if (prop === '$transaction') {
        return (...args) => withPrismaRetry(() => runTransaction(...args));
      }
      const value = Reflect.get(target, prop, receiver);
      if (typeof value === 'function') return value.bind(target);
      return value;
    },
  });
}

function shouldWarmPool() {
  return process.env.NEXT_PHASE !== 'phase-production-build';
}

/**
 * Prisma client for MySQL/MariaDB.
 * Table queries from getMysqlClient() go through this client.
 * MYSQL_DATABASE_URL is required.
 * @returns {PrismaClient}
 */
export function getPrisma() {
  const url = process.env.MYSQL_DATABASE_URL;
  if (!url) {
    throw new Error('MYSQL_DATABASE_URL is not set');
  }

  if (!globalForPrisma.__wellnessPrisma) {
    const client = new PrismaClient({
      datasources: { db: { url: withMysqlPoolParams(url) } },
      log: ['error'],
    });
    globalForPrisma.__wellnessPrisma = withRetryClient(client);
    if (shouldWarmPool()) {
      client.$connect().catch((err) => {
        logger.warn('Prisma pool warmup failed; first query will connect', {
          message: err?.message || String(err),
        });
      });
    }
  }

  return globalForPrisma.__wellnessPrisma;
}

/**
 * Open the pool without failing process startup when MilesWeb is briefly down.
 * @returns {Promise<void>}
 */
export async function connectPrisma() {
  if (!process.env.MYSQL_DATABASE_URL || !shouldWarmPool()) return;
  try {
    await getPrisma().$connect();
  } catch (err) {
    logger.warn('Prisma pool warmup failed; first query will connect', {
      message: err?.message || String(err),
    });
  }
}
