/**
 * Run: node --test backend/shared/lib/__tests__/db-pool-metrics.test.js
 */
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  currentPoolMetrics,
  isDbPoolMetricsEnabled,
  logPoolMetricsProcessStart,
  measurePrismaOperation,
  metricsRoutePath,
  poolTimeoutCode,
  withPrismaRetry,
} from '../prisma.js';
import { runService } from '../handler.js';
import {
  resetPoolMetricsLogForTests,
  setPoolMetricsLogObserver,
} from '../dbPoolMetricsLog.js';

const SECRET = 'select-secret-phone-919800011122';

function mockRes(method, url) {
  return {
    req: { method, url },
    statusCode: null,
    body: null,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function delay(ms) {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}

describe('db pool metrics', () => {
  const previousFlag = process.env.DB_POOL_METRICS;
  const previousNodeEnv = process.env.NODE_ENV;
  let infoLines = [];
  let records = [];
  const originalInfo = console.info;

  function enable() {
    process.env.DB_POOL_METRICS = '1';
  }

  function captureInfo() {
    infoLines = [];
    records = [];
    console.info = (line) => {
      infoLines.push(String(line));
    };
    setPoolMetricsLogObserver((record) => {
      records.push(record);
    });
  }

  function metricsLines() {
    return records;
  }

  afterEach(() => {
    if (previousFlag === undefined) delete process.env.DB_POOL_METRICS;
    else process.env.DB_POOL_METRICS = previousFlag;
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    console.info = originalInfo;
    resetPoolMetricsLogForTests();
  });

  it('stays disabled unless DB_POOL_METRICS is exactly 1', async () => {
    delete process.env.DB_POOL_METRICS;
    process.env.NODE_ENV = 'production';
    assert.equal(isDbPoolMetricsEnabled(), false);
    process.env.DB_POOL_METRICS = 'true';
    process.env.NODE_ENV = 'development';
    assert.equal(isDbPoolMetricsEnabled(), false);

    captureInfo();
    let calls = 0;
    const nowCalls = [];
    const result = await withPrismaRetry(async () => {
      calls += 1;
      if (calls === 1) {
        const err = new Error(SECRET);
        err.code = 'P2024';
        throw err;
      }
      return 'ok';
    });
    const measured = await measurePrismaOperation(async () => 'skipped', () => {
      nowCalls.push(1);
      return 0;
    });
    const res = mockRes('GET', `/api/diary/list?ownerUserId=99&note=${SECRET}`);
    await runService(res, async () => ({ httpStatus: 200, body: { token: SECRET } }));

    assert.equal(result, 'ok');
    assert.equal(calls, 2);
    assert.equal(measured, 'skipped');
    assert.equal(nowCalls.length, 0);
    assert.equal(currentPoolMetrics(), null);
    assert.equal(infoLines.some((line) => line.includes('db pool metrics')), false);
    assert.equal(infoLines.some((line) => line.includes(SECRET)), false);
  });

  it('keeps concurrent request stores apart', async () => {
    enable();
    captureInfo();
    const [first, second] = await Promise.all([
      runService(mockRes('GET', '/api/one?ownerUserId=11'), async () => {
        await delay(30);
        assert.equal(currentPoolMetrics().route, '/api/one');
        assert.equal(currentPoolMetrics().prismaOperationCount, 0);
        await measurePrismaOperation(async () => {
          await delay(20);
          return 'one';
        });
        assert.equal(currentPoolMetrics().route, '/api/one');
        assert.equal(currentPoolMetrics().prismaOperationCount, 1);
        return { httpStatus: 200, body: { ok: true } };
      }),
      runService(mockRes('POST', '/api/two?ownerUserId=22'), async () => {
        await measurePrismaOperation(async () => 'two-a');
        await measurePrismaOperation(async () => 'two-b');
        assert.equal(currentPoolMetrics().route, '/api/two');
        assert.equal(currentPoolMetrics().method, 'POST');
        assert.equal(currentPoolMetrics().prismaOperationCount, 2);
        return { httpStatus: 201, body: { ok: true } };
      }),
    ]);

    assert.equal(first.statusCode, 200);
    assert.equal(second.statusCode, 201);
    const lines = metricsLines();
    const one = lines.find((line) => line.route === '/api/one');
    const two = lines.find((line) => line.route === '/api/two');
    assert.equal(one.method, 'GET');
    assert.equal(one.prismaOperations, 1);
    assert.equal(one.pid, process.pid);
    assert.equal(one.timing, 'client-elapsed-includes-pool-wait');
    assert.equal(two.method, 'POST');
    assert.equal(two.status, 201);
    assert.equal(two.prismaOperations, 2);
    assert.equal(two.pid, process.pid);
    assert.equal(lines.some((line) => JSON.stringify(line).includes('ownerUserId')), false);
  });

  it('counts Prisma client operations and labels the elapsed time', async () => {
    enable();
    captureInfo();
    let tick = 1000;
    const now = () => {
      const value = tick;
      tick += 40;
      return value;
    };
    const res = mockRes('GET', '/api/diary/list?date=2026-11-03');
    await runService(res, async () => {
      const value = await measurePrismaOperation(async () => 'row', now);
      assert.equal(value, 'row');
      const snapshot = currentPoolMetrics();
      assert.equal(snapshot.prismaOperationCount, 1);
      assert.equal(snapshot.prismaClientElapsedMs, 40);
      return { httpStatus: 200, body: { ok: true } };
    });
    const line = metricsLines()[0];
    assert.equal(line.route, '/api/diary/list');
    assert.equal(line.prismaOperations, 1);
    assert.equal(line.prismaClientElapsedMs, 40);
    assert.equal(line.timing, 'client-elapsed-includes-pool-wait');
    assert.equal(line.wallMs >= 0, true);
  });

  it('counts P2024 and P2028 from err.code before retry handling', async () => {
    enable();
    captureInfo();
    assert.equal(poolTimeoutCode({ code: 'P2024', message: SECRET }), 'P2024');
    assert.equal(poolTimeoutCode({ code: 'P2028', message: SECRET }), 'P2028');
    assert.equal(poolTimeoutCode({ code: 'P2002', message: SECRET }), null);
    assert.equal(poolTimeoutCode({ message: 'timed out fetching a new connection' }), null);
    assert.equal(poolTimeoutCode({ meta: { code: 'P2024' }, message: SECRET }), null);

    let poolCalls = 0;
    const poolRes = mockRes('GET', '/api/weight/history?userId=1268');
    await runService(poolRes, async () => {
      const value = await withPrismaRetry(async () => {
        poolCalls += 1;
        if (poolCalls === 1) {
          const err = new Error(SECRET);
          err.code = 'P2024';
          throw err;
        }
        return 'retried';
      });
      assert.equal(value, 'retried');
      assert.equal(currentPoolMetrics().p2024, 1);
      assert.equal(currentPoolMetrics().p2028, 0);
      return { httpStatus: 200, body: { ok: true } };
    });

    let transactionCalls = 0;
    const transactionRes = mockRes('POST', '/api/food?userId=1268');
    await runService(transactionRes, async () => {
      await withPrismaRetry(async () => {
        transactionCalls += 1;
        const err = new Error(SECRET);
        err.code = 'P2028';
        throw err;
      });
      return { httpStatus: 200, body: { ok: true } };
    });

    let messageCalls = 0;
    await runService(mockRes('GET', '/api/water/intake'), async () => {
      await withPrismaRetry(async () => {
        messageCalls += 1;
        if (messageCalls === 1) throw new Error('timed out fetching a new connection');
        return 'ok';
      });
      assert.equal(currentPoolMetrics().p2024, 0);
      assert.equal(currentPoolMetrics().p2028, 0);
      return { httpStatus: 200, body: { ok: true } };
    });

    assert.equal(poolCalls, 2);
    assert.equal(transactionCalls, 1);
    assert.equal(transactionRes.statusCode, 500);
    const lines = metricsLines();
    const poolLine = lines.find((line) => line.route === '/api/weight/history');
    const transactionLine = lines.find((line) => line.route === '/api/food');
    assert.equal(poolLine.p2024, 1);
    assert.equal(poolLine.p2028, 0);
    assert.equal(poolLine.status, 200);
    assert.equal(transactionLine.p2024, 0);
    assert.equal(transactionLine.p2028, 1);
    assert.equal(transactionLine.status, 500);
    assert.equal(lines.some((line) => JSON.stringify(line).includes(SECRET)), false);
    assert.equal(lines.some((line) => JSON.stringify(line).includes('userId')), false);
  });

  it('records a request that performs no Prisma operations', async () => {
    enable();
    captureInfo();
    const res = mockRes('GET', '/api/user/profile?userId=50');
    await runService(res, async () => {
      assert.equal(currentPoolMetrics().prismaOperationCount, 0);
      assert.equal(currentPoolMetrics().prismaClientElapsedMs, 0);
      return { httpStatus: 204, body: { profile: SECRET } };
    });
    const line = metricsLines()[0];
    assert.equal(line.method, 'GET');
    assert.equal(line.route, '/api/user/profile');
    assert.equal(line.status, 204);
    assert.equal(line.pid, process.pid);
    assert.equal(line.prismaOperations, 0);
    assert.equal(line.prismaClientElapsedMs, 0);
    assert.equal(line.p2024, 0);
    assert.equal(line.p2028, 0);
    assert.equal(JSON.stringify(line).includes(SECRET), false);
    assert.equal(JSON.stringify(line).includes('userId'), false);
  });

  it('still retries a dropped connection once and does not retry a duplicate key', async () => {
    enable();
    let dropped = 0;
    const droppedResult = await withPrismaRetry(async () => {
      dropped += 1;
      if (dropped === 1) {
        const err = new Error('Server has gone away');
        err.code = 'P1017';
        throw err;
      }
      return 'ok';
    });
    assert.equal(droppedResult, 'ok');
    assert.equal(dropped, 2);

    let duplicate = 0;
    await assert.rejects(() => withPrismaRetry(async () => {
      duplicate += 1;
      const err = new Error('Unique constraint failed');
      err.code = 'P2002';
      throw err;
    }), (err) => err.code === 'P2002');
    assert.equal(duplicate, 1);
    assert.equal(currentPoolMetrics(), null);
  });

  it('logs the process id once when metrics are enabled', () => {
    captureInfo();
    delete process.env.DB_POOL_METRICS;
    assert.equal(logPoolMetricsProcessStart(), false);
    assert.equal(infoLines.length, 0);
    enable();
    assert.equal(logPoolMetricsProcessStart(), true);
    const line = metricsLines()[0];
    assert.equal(line.pid, process.pid);
    assert.equal(Object.keys(line).includes('message'), false);
    assert.equal(metricsRoutePath('/api/diary/list?ownerUserId=1'), '/api/diary/list');
    assert.equal(metricsRoutePath('http://db.example/api/diary/list'), null);
  });
});
