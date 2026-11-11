/**
 * Run: node --test backend/shared/lib/__tests__/db-pool-metrics-log.test.js
 */
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  STAGING_APP_ROOT,
  bindPoolMetricsLogShutdown,
  configurePoolMetricsLogForTests,
  finishPoolMetricsLogForTests,
  flushPoolMetricsLog,
  isPoolMetricsFileAllowed,
  poolMetricsLogOpenCount,
  resetPoolMetricsLogForTests,
  writePoolMetricsLine,
} from '../dbPoolMetricsLog.js';
import { runService } from '../handler.js';

const SECRET = 'select-secret-phone-919800011122';
const previousCwd = process.cwd();
const previousFlag = process.env.DB_POOL_METRICS;

function enable() {
  process.env.DB_POOL_METRICS = '1';
}

function mockRes(method, url) {
  return {
    req: { method, url },
    statusCode: null,
    body: null,
    setHeader() {},
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function waitFor(check) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      if (check()) {
        resolve();
        return;
      }
      if (Date.now() - started > 1000) {
        reject(new Error('timed out'));
        return;
      }
      setTimeout(tick, 10);
    };
    tick();
  });
}

describe('db pool metrics file', () => {
  const dirs = [];

  function tempDir(name) {
    const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), name)));
    dirs.push(dir);
    return dir;
  }

  afterEach(() => {
    process.chdir(previousCwd);
    if (previousFlag === undefined) delete process.env.DB_POOL_METRICS;
    else process.env.DB_POOL_METRICS = previousFlag;
    resetPoolMetricsLogForTests();
    for (const dir of dirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('does not open a file when the flag is off', () => {
    const staging = tempDir('test-wellness-api-');
    delete process.env.DB_POOL_METRICS;
    configurePoolMetricsLogForTests({ stagingRoot: staging });
    process.chdir(staging);
    assert.equal(isPoolMetricsFileAllowed(), false);
    assert.equal(writePoolMetricsLine({
      message: 'db pool metrics',
      method: 'GET',
      route: '/api/diary/list',
    }), false);
    assert.equal(fs.existsSync(path.join(staging, 'db-pool-metrics.log')), false);
    assert.equal(poolMetricsLogOpenCount(), 0);
  });

  it('rejects a production directory and any directory that is not the staging root', () => {
    const production = tempDir('wellness-api-');
    const other = tempDir('test-wellness-api-');
    enable();
    process.chdir(production);
    assert.equal(isPoolMetricsFileAllowed(), false);
    assert.equal(isPoolMetricsFileAllowed(production), false);
    assert.notEqual(fs.realpathSync(production), STAGING_APP_ROOT);
    assert.equal(writePoolMetricsLine({
      message: 'db pool metrics',
      method: 'GET',
      route: `/api/diary/list?ownerUserId=4&note=${SECRET}`,
      sql: SECRET,
      phone: '919800011122',
      userId: 4,
    }), false);
    assert.equal(fs.existsSync(path.join(production, 'db-pool-metrics.log')), false);
    assert.equal(fs.existsSync(path.join(STAGING_APP_ROOT, 'db-pool-metrics.log')), false);

    process.chdir(other);
    assert.equal(writePoolMetricsLine({ message: 'db pool metrics listening', pid: process.pid }), false);
    assert.equal(fs.existsSync(path.join(other, 'db-pool-metrics.log')), false);
    assert.equal(poolMetricsLogOpenCount(), 0);
  });

  it('appends two summaries through one stream only inside the staging directory', async () => {
    const staging = tempDir('test-wellness-api-');
    enable();
    configurePoolMetricsLogForTests({ stagingRoot: staging });
    process.chdir(staging);
    assert.equal(isPoolMetricsFileAllowed(), true);
    assert.equal(writePoolMetricsLine({
      message: 'db pool metrics listening',
      pid: process.pid,
      userId: 9,
      route: '/api/diary/list?ownerUserId=9',
    }), true);
    assert.equal(writePoolMetricsLine({
      message: 'db pool metrics',
      pid: process.pid,
      method: 'GET',
      route: `/api/diary/list?ownerUserId=9&q=${SECRET}`,
      status: 200,
      wallMs: 4,
      prismaOperations: 2,
      prismaClientElapsedMs: 15,
      timing: 'client-elapsed-includes-pool-wait',
      p2024: 0,
      p2028: 0,
      sql: SECRET,
      phone: '919800011122',
    }), true);
    assert.equal(poolMetricsLogOpenCount(), 1);
    await finishPoolMetricsLogForTests();
    const text = fs.readFileSync(path.join(staging, 'db-pool-metrics.log'), 'utf8');
    assert.match(text, /\[INFO\] db pool metrics listening /);
    assert.match(text, /\[INFO\] db pool metrics /);
    assert.equal(text.includes(SECRET), false);
    assert.equal(text.includes('ownerUserId'), false);
    assert.equal(text.includes('919800011122'), false);
    assert.equal(text.includes('"userId"'), false);
    assert.match(text, /"route":"\/api\/diary\/list"/);
  });

  it('drops lines while the stream buffer is full and does not wait', () => {
    const staging = tempDir('test-wellness-api-');
    const chunks = [];
    let accept = true;
    const handlers = {};
    enable();
    configurePoolMetricsLogForTests({
      stagingRoot: staging,
      createStream() {
        return {
          write(chunk) {
            chunks.push(chunk);
            return accept;
          },
          end(callback) { if (callback) callback(); },
          on(event, fn) { handlers[event] = fn; return this; },
          removeAllListeners() {},
          destroy() {},
        };
      },
    });
    process.chdir(staging);
    accept = false;
    const started = Date.now();
    assert.equal(writePoolMetricsLine({
      message: 'db pool metrics',
      method: 'GET',
      route: '/api/diary/list',
    }), true);
    assert.equal(writePoolMetricsLine({
      message: 'db pool metrics',
      method: 'GET',
      route: '/api/water/intake',
    }), false);
    assert.equal(Date.now() - started < 200, true);
    assert.equal(chunks.length, 1);
    handlers.drain();
    assert.equal(chunks.length, 2);
    assert.match(chunks[1], /"dropped":1/);
    assert.equal(chunks[1].includes('/api/water/intake'), false);
  });

  it('rotates once at the size cap and keeps only the backup', async () => {
    const staging = tempDir('test-wellness-api-');
    enable();
    configurePoolMetricsLogForTests({
      stagingRoot: staging,
      maxBytes: 80,
      rotateEvery: 1,
    });
    process.chdir(staging);
    assert.equal(writePoolMetricsLine({
      message: 'db pool metrics',
      method: 'GET',
      route: '/api/diary/list',
      wallMs: 1,
      prismaOperations: 1,
      prismaClientElapsedMs: 1,
      timing: 'client-elapsed-includes-pool-wait',
      p2024: 0,
      p2028: 0,
    }), true);
    const backup = path.join(staging, 'db-pool-metrics.log.1');
    await waitFor(() => fs.existsSync(backup));
    const archived = fs.readFileSync(backup, 'utf8');
    assert.match(archived, /\/api\/diary\/list/);
    await new Promise((resolve) => { setTimeout(resolve, 30); });
    assert.equal(writePoolMetricsLine({
      message: 'db pool metrics',
      method: 'POST',
      route: '/api/weight/history',
    }), true);
    await finishPoolMetricsLogForTests();
    assert.equal(fs.existsSync(backup), true);
    assert.equal(fs.existsSync(path.join(staging, 'db-pool-metrics.log.2')), false);
  });

  it('keeps serving the request when rotation or the stream fails', async () => {
    const staging = tempDir('test-wellness-api-');
    enable();
    configurePoolMetricsLogForTests({
      stagingRoot: staging,
      maxBytes: 1,
      rotateEvery: 1,
      renameActiveFile() {
        throw new Error(SECRET);
      },
    });
    process.chdir(staging);
    const res = mockRes('GET', `/api/diary/list?ownerUserId=3&note=${SECRET}`);
    const response = await runService(res, async () => ({ httpStatus: 200, body: { token: SECRET } }));
    assert.equal(response.statusCode, 200);
    await waitFor(() => true);
    assert.equal(writePoolMetricsLine({
      message: 'db pool metrics',
      method: 'GET',
      route: '/api/diary/list',
    }), false);
  });

  it('flushes on SIGTERM and SIGINT without adding the listener twice', () => {
    const beforeTerm = process.listeners('SIGTERM').length;
    const beforeInt = process.listeners('SIGINT').length;
    bindPoolMetricsLogShutdown();
    bindPoolMetricsLogShutdown();
    assert.equal(process.listeners('SIGTERM').length, beforeTerm + 1);
    assert.equal(process.listeners('SIGINT').length, beforeInt + 1);
    flushPoolMetricsLog();
    assert.equal(writePoolMetricsLine({
      message: 'db pool metrics listening',
      pid: process.pid,
    }), false);
  });
});
