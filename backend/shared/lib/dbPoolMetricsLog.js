import fs from 'node:fs';
import path from 'node:path';

/** Staging application root. Production must not resolve to this path. */
export const STAGING_APP_ROOT = '/home/yvyunomg/test-wellness-api';

export const POOL_METRICS_LOG_MAX_BYTES = 32 * 1024 * 1024;

const LOG_FILE_NAME = 'db-pool-metrics.log';
const DEFAULT_ROTATE_EVERY = 100;

const REQUEST_FIELDS = [
  'pid',
  'method',
  'route',
  'status',
  'wallMs',
  'prismaOperations',
  'prismaClientElapsedMs',
  'timing',
  'p2024',
  'p2028',
];

let stagingRoot = STAGING_APP_ROOT;
let maxBytes = POOL_METRICS_LOG_MAX_BYTES;
let rotateEvery = DEFAULT_ROTATE_EVERY;
let stream = null;
let createStream = defaultCreateStream;
let renameActiveFile = defaultRenameActiveFile;
let observer = null;
let openCount = 0;
let bytesWritten = 0;
let writesSinceCheck = 0;
let dropped = 0;
let paused = false;
let rotating = false;
let acceptWrites = true;
let disabled = false;
let disabledNoticeSent = false;
let unavailableNoticeSent = false;
let signalsBound = false;
let generation = 0;

function defaultCreateStream(filePath) {
  return fs.createWriteStream(filePath, { flags: 'a', mode: 0o600 });
}

function defaultRenameActiveFile(activePath) {
  const backup = `${activePath}.1`;
  fs.rmSync(backup, { force: true });
  if (fs.existsSync(activePath)) fs.renameSync(activePath, backup);
}

function logPath() {
  return path.join(stagingRoot, LOG_FILE_NAME);
}

function notifyDisabled() {
  if (process.env.DB_POOL_METRICS !== '1') return;
  if (disabledNoticeSent) return;
  disabledNoticeSent = true;
  console.error('[ERROR] db pool metrics file disabled');
}

function notifyUnavailable() {
  if (unavailableNoticeSent) return;
  unavailableNoticeSent = true;
  console.error('[ERROR] db pool metrics file unavailable');
}

/**
 * True only for the staging application directory while the flag is exactly "1".
 * @param {string} [cwd]
 * @returns {boolean}
 */
export function isPoolMetricsFileAllowed(cwd = process.cwd()) {
  if (process.env.DB_POOL_METRICS !== '1') return false;
  let current;
  try {
    current = fs.realpathSync(cwd);
  } catch {
    return false;
  }
  if (current === stagingRoot) return true;
  try {
    return current === fs.realpathSync(stagingRoot);
  } catch {
    return false;
  }
}

function pathnameOnly(route) {
  if (typeof route !== 'string' || !route.startsWith('/')) return null;
  const pathOnly = route.split('#')[0].split('?')[0];
  return pathOnly.startsWith('/') ? pathOnly : null;
}

function requestRecord(fields) {
  const record = {};
  for (const key of REQUEST_FIELDS) {
    if (fields[key] !== undefined) record[key] = fields[key];
  }
  record.route = pathnameOnly(fields.route);
  return record;
}

function listeningRecord(fields) {
  const pid = Number(fields.pid);
  return { pid: Number.isInteger(pid) ? pid : process.pid };
}

function sanitize(fields) {
  if (!fields || typeof fields !== 'object') return null;
  if (fields.message === 'db pool metrics listening') {
    return { message: fields.message, record: listeningRecord(fields) };
  }
  if (fields.message === 'db pool metrics') {
    return { message: fields.message, record: requestRecord(fields) };
  }
  return null;
}

function fileSize(file) {
  try {
    return fs.statSync(file).size;
  } catch {
    return 0;
  }
}

function onDrain() {
  paused = false;
  try {
    flushDroppedLine();
  } catch {
    notifyUnavailable();
  }
}

function detachQuietly(current) {
  if (!current) return;
  current.removeAllListeners();
  current.on('error', () => {});
  try {
    current.destroy();
  } catch {
    notifyUnavailable();
  }
}

function onStreamError() {
  disabled = true;
  paused = true;
  const current = stream;
  stream = null;
  detachQuietly(current);
  notifyUnavailable();
}

function ensureStream() {
  if (!acceptWrites || disabled || rotating) return null;
  if (stream) return stream;
  if (!isPoolMetricsFileAllowed()) return null;
  try {
    const active = logPath();
    if (fileSize(active) >= maxBytes) {
      renameActiveFile(active);
    }
    const sizeNow = fileSize(active);
    const opened = createStream(active);
    openCount += 1;
    stream = opened;
    bytesWritten = sizeNow;
    opened.on('error', onStreamError);
    opened.on('drain', onDrain);
    return opened;
  } catch {
    disabled = true;
    notifyUnavailable();
    return null;
  }
}

function writeChunk(line) {
  const opened = ensureStream();
  if (!opened) return false;
  const ok = opened.write(line);
  bytesWritten += Buffer.byteLength(line);
  writesSinceCheck += 1;
  if (!ok) paused = true;
  maybeRotate();
  return true;
}

function flushDroppedLine() {
  if (dropped === 0 || paused || rotating || disabled || !acceptWrites) return;
  const count = dropped;
  dropped = 0;
  const line = `[INFO] db pool metrics ${JSON.stringify({ dropped: count })}\n`;
  if (!writeChunk(line)) dropped += count;
}

function finishRotate(ok) {
  rotating = false;
  if (!ok) {
    disabled = true;
    notifyUnavailable();
    return;
  }
  bytesWritten = 0;
  paused = false;
  try {
    flushDroppedLine();
  } catch {
    notifyUnavailable();
  }
}

function maybeRotate() {
  if (writesSinceCheck < rotateEvery) return;
  writesSinceCheck = 0;
  if (bytesWritten < maxBytes || !stream || rotating) return;
  const current = stream;
  const active = logPath();
  const gen = generation;
  stream = null;
  rotating = true;
  paused = true;
  try {
    current.end(() => {
      if (gen !== generation) return;
      try {
        renameActiveFile(active);
        finishRotate(true);
      } catch {
        finishRotate(false);
      }
    });
  } catch {
    finishRotate(false);
  }
}

function deliver(message, record) {
  if (observer) {
    try {
      observer({ ...record });
    } catch {
      notifyUnavailable();
    }
  }
  if (!isPoolMetricsFileAllowed()) {
    notifyDisabled();
    return false;
  }
  if (paused || rotating) {
    dropped += 1;
    return false;
  }
  const line = `[INFO] ${message} ${JSON.stringify(record)}\n`;
  const wrote = writeChunk(line);
  if (wrote && !paused) flushDroppedLine();
  return wrote;
}

/**
 * Append one metrics record. Never throws. Unknown messages are ignored.
 * The file is opened only for the staging application root.
 * @param {object} fields
 * @returns {boolean}
 */
export function writePoolMetricsLine(fields) {
  try {
    if (!acceptWrites || process.env.DB_POOL_METRICS !== '1') return false;
    const clean = sanitize(fields);
    if (!clean) return false;
    return deliver(clean.message, clean.record);
  } catch {
    notifyUnavailable();
    return false;
  }
}

/** @param {(record: object) => void|null} fn */
export function setPoolMetricsLogObserver(fn) {
  observer = typeof fn === 'function' ? fn : null;
}

/** @returns {number} */
export function poolMetricsLogOpenCount() {
  return openCount;
}

/**
 * End the stream so the last buffer can flush. Does not exit the process.
 */
export function flushPoolMetricsLog() {
  acceptWrites = false;
  const current = stream;
  stream = null;
  if (!current) return;
  try {
    current.end();
  } catch {
    notifyUnavailable();
  }
}

/** Test helper. Resolves after the open stream finishes flushing. */
export function finishPoolMetricsLogForTests() {
  return new Promise((resolve) => {
    const current = stream;
    if (!current) {
      resolve();
      return;
    }
    stream = null;
    const done = () => resolve();
    current.on('error', done);
    current.once('finish', done);
    try {
      current.end();
    } catch {
      resolve();
    }
  });
}

/**
 * Add shutdown listeners without removing listeners already registered.
 */
export function bindPoolMetricsLogShutdown() {
  if (signalsBound) return;
  signalsBound = true;
  process.once('SIGTERM', flushPoolMetricsLog);
  process.once('SIGINT', flushPoolMetricsLog);
}

/**
 * Test-only target. Production never calls this.
 * @param {{ stagingRoot?: string, maxBytes?: number, rotateEvery?: number,
 *   createStream?: (filePath: string) => object,
 *   renameActiveFile?: (activePath: string) => void }} options
 */
export function configurePoolMetricsLogForTests(options = {}) {
  resetPoolMetricsLogForTests();
  if (options.stagingRoot) stagingRoot = options.stagingRoot;
  if (Number.isInteger(options.maxBytes) && options.maxBytes > 0) maxBytes = options.maxBytes;
  if (Number.isInteger(options.rotateEvery) && options.rotateEvery > 0) rotateEvery = options.rotateEvery;
  if (typeof options.createStream === 'function') createStream = options.createStream;
  if (typeof options.renameActiveFile === 'function') renameActiveFile = options.renameActiveFile;
}

/** Test-only reset. */
export function resetPoolMetricsLogForTests() {
  if (signalsBound) {
    process.removeListener('SIGTERM', flushPoolMetricsLog);
    process.removeListener('SIGINT', flushPoolMetricsLog);
    signalsBound = false;
  }
  if (stream) detachQuietly(stream);
  stream = null;
  stagingRoot = STAGING_APP_ROOT;
  maxBytes = POOL_METRICS_LOG_MAX_BYTES;
  rotateEvery = DEFAULT_ROTATE_EVERY;
  createStream = defaultCreateStream;
  renameActiveFile = defaultRenameActiveFile;
  observer = null;
  openCount = 0;
  bytesWritten = 0;
  writesSinceCheck = 0;
  dropped = 0;
  paused = false;
  rotating = false;
  acceptWrites = true;
  disabled = false;
  disabledNoticeSent = false;
  unavailableNoticeSent = false;
  generation += 1;
}
