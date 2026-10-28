/**
 * Run: node --test backend/shared/lib/__tests__/prisma-pool.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MYSQL_POOL_DEFAULTS,
  isTransientConnectionError,
  withMysqlPoolParams,
  withPrismaRetry,
} from '../prisma.js';

describe('withMysqlPoolParams', () => {
  it('adds default pool params without changing user, host, or database', () => {
    const url = 'mysql://app:p%40ssword@db.example:3306/wellness';
    const pooled = withMysqlPoolParams(url);
    assert.equal(pooled.startsWith('mysql://app:p%40ssword@db.example:3306/wellness?'), true);
    const params = new URLSearchParams(pooled.slice(pooled.indexOf('?') + 1));
    assert.equal(params.get('connection_limit'), MYSQL_POOL_DEFAULTS.connection_limit);
    assert.equal(params.get('pool_timeout'), MYSQL_POOL_DEFAULTS.pool_timeout);
    assert.equal(params.get('connect_timeout'), MYSQL_POOL_DEFAULTS.connect_timeout);
  });

  it('does not override pool params already set in the URL', () => {
    const url = 'mysql://u:p@h:3306/db?connection_limit=5&pool_timeout=9';
    const params = new URLSearchParams(withMysqlPoolParams(url).split('?')[1]);
    assert.equal(params.get('connection_limit'), '5');
    assert.equal(params.get('pool_timeout'), '9');
    assert.equal(params.get('connect_timeout'), MYSQL_POOL_DEFAULTS.connect_timeout);
  });
});

describe('isTransientConnectionError', () => {
  it('retries dropped-socket Prisma and MySQL codes', () => {
    assert.equal(isTransientConnectionError({ code: 'P1017' }), true);
    assert.equal(isTransientConnectionError({ code: 'P1001' }), true);
    assert.equal(isTransientConnectionError({ code: 'P2024' }), true);
    assert.equal(isTransientConnectionError({ code: 'PROTOCOL_CONNECTION_LOST' }), true);
    assert.equal(isTransientConnectionError({ message: 'Server has gone away' }), true);
  });

  it('does not retry unique, missing-row, or raw SQL errors', () => {
    assert.equal(isTransientConnectionError({ code: 'P2002', message: 'Unique constraint failed' }), false);
    assert.equal(isTransientConnectionError({ code: 'P2025', message: 'Record not found' }), false);
    assert.equal(isTransientConnectionError({
      code: 'P2010',
      message: 'Raw query failed. Code: `1062`.',
      meta: { code: '1062' },
    }), false);
    assert.equal(isTransientConnectionError({ code: 'P1008', message: 'Operations timed out' }), false);
  });
});

describe('withPrismaRetry', () => {
  it('retries once after a dropped connection and then returns', async () => {
    let calls = 0;
    const result = await withPrismaRetry(async () => {
      calls += 1;
      if (calls === 1) {
        const err = new Error('Server has gone away');
        err.code = 'P1017';
        throw err;
      }
      return 'ok';
    });
    assert.equal(result, 'ok');
    assert.equal(calls, 2);
  });

  it('does not retry a duplicate-key error', async () => {
    let calls = 0;
    await assert.rejects(() => withPrismaRetry(async () => {
      calls += 1;
      const err = new Error('Unique constraint failed');
      err.code = 'P2002';
      throw err;
    }), (err) => err.code === 'P2002');
    assert.equal(calls, 1);
  });
});
