import { PrismaClient } from '@prisma/client';
import logger from './logger.js';

const globalForPrisma = globalThis;

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
 * Run `fn` once more after a dropped connection. Other errors throw as-is.
 * @template T
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function withPrismaRetry(fn) {
  try {
    return await fn();
  } catch (err) {
    if (!isTransientConnectionError(err)) throw err;
    logger.warn('MySQL connection lost; retrying once', { code: err.code || null });
    return fn();
  }
}

function withRetryClient(client) {
  const extended = client.$extends({
    query: {
      async $allOperations({ args, query }) {
        return withPrismaRetry(() => query(args));
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
