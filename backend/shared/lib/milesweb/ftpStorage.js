/**
 * Read and write image bytes on the MilesWeb account over FTP.
 * The API process runs on this machine, so it cannot use the server disk directly.
 */
import { Readable, Writable } from 'stream';
import { Client } from 'basic-ftp';
import { isMileswebStorageEnabled, readMileswebConfig } from './config.js';
import { isAllowedUploadKey } from './objectKey.js';

const existsCache = new Map();
const HIT_MS = 5 * 60 * 1000;
const MISS_MS = 20 * 1000;

function remotePath(config, key) {
  return `${config.uploadRoot}/${key}`;
}

async function withClient(fn) {
  if (!isMileswebStorageEnabled()) {
    throw new Error('MilesWeb image storage is not configured');
  }
  const config = readMileswebConfig();
  const client = new Client(20000);
  try {
    await client.access({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      secure: config.secure,
    });
    return await fn(client, config);
  } finally {
    client.close();
  }
}

export function rememberMileswebObject(key) {
  if (!isAllowedUploadKey(key)) return;
  existsCache.set(key, { ok: true, at: Date.now() });
}

export function forgetMileswebObject(key) {
  existsCache.delete(key);
}

export async function mileswebObjectExists(key) {
  if (!isAllowedUploadKey(key) || !isMileswebStorageEnabled()) return false;
  const cached = existsCache.get(key);
  if (cached) {
    const maxAge = cached.ok ? HIT_MS : MISS_MS;
    if (Date.now() - cached.at < maxAge) return cached.ok;
  }
  let ok = false;
  try {
    await withClient(async (client, config) => {
      const size = await client.size(remotePath(config, key));
      ok = Number(size) >= 0;
    });
  } catch {
    ok = false;
  }
  existsCache.set(key, { ok, at: Date.now() });
  return ok;
}

export async function putMileswebObject({ key, body }) {
  if (!isAllowedUploadKey(key)) {
    throw new Error('Image key must stay inside the MilesWeb upload folders');
  }
  const bytes = Buffer.isBuffer(body) ? body : Buffer.from(body);
  await withClient(async (client, config) => {
    const full = remotePath(config, key);
    const slash = full.lastIndexOf('/');
    const dir = full.slice(0, slash);
    const name = full.slice(slash + 1);
    await client.ensureDir(dir);
    await client.uploadFrom(Readable.from(bytes), name);
  });
  rememberMileswebObject(key);
  return { key };
}

export async function readMileswebObject(key) {
  if (!isAllowedUploadKey(key) || !isMileswebStorageEnabled()) return null;
  try {
    return await withClient(async (client, config) => {
      const chunks = [];
      const sink = new Writable({
        write(chunk, _enc, callback) {
          chunks.push(Buffer.from(chunk));
          callback();
        },
      });
      await client.downloadTo(sink, remotePath(config, key));
      const bytes = Buffer.concat(chunks);
      if (!bytes.length || bytes.length > 8 * 1024 * 1024) return null;
      rememberMileswebObject(key);
      return bytes;
    });
  } catch {
    return null;
  }
}

export async function deleteMileswebObject(key) {
  if (!isAllowedUploadKey(key) || !isMileswebStorageEnabled()) return;
  forgetMileswebObject(key);
  try {
    await withClient(async (client, config) => {
      await client.remove(remotePath(config, key));
    });
  } catch (err) {
    const message = err?.message || String(err);
    if (!/550|not found|no such file/i.test(message)) throw err;
  }
}
