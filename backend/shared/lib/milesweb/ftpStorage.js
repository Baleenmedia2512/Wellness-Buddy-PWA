/**
 * Read and write image bytes on the MilesWeb account over FTP.
 * The API process runs on this machine, so it cannot use the server disk directly.
 * basic-ftp is loaded only when a MilesWeb FTP account is configured, so API
 * routes keep compiling on the existing R2 / MySQL-base64 path.
 */
import { Readable, Writable } from 'stream';
import { isMileswebStorageEnabled, readMileswebConfig } from './config.js';
import { isAllowedUploadKey } from './objectKey.js';

const existsCache = new Map();
const HIT_MS = 5 * 60 * 1000;
const MISS_MS = 20 * 1000;

function remotePath(config, key) {
  const root = config.uploadRoot;
  if (!root || root === '.') return key;
  return `${root}/${key}`;
}

/**
 * Files were saved at the FTP home (`captures/...`) and also under
 * `wellnessvalley/uploads/`. The live root setting only names one of those.
 * @param {string} key
 * @param {{ uploadRoot?: string }} [config]
 * @returns {string[]}
 */
export function mileswebPathCandidates(key, config = readMileswebConfig()) {
  if (!isAllowedUploadKey(key)) return [];
  const primary = remotePath(config, key);
  const atHome = key;
  const underUploads = `wellnessvalley/uploads/${key}`;
  return [...new Set([primary, atHome, underUploads])];
}

function isMissingFileError(err) {
  return /550|not found|no such file|cannot find|can't check/i.test(err?.message || String(err || ''));
}

async function withClient(fn) {
  if (!isMileswebStorageEnabled()) {
    throw new Error('MilesWeb image storage is not configured');
  }
  const { Client } = await import('basic-ftp');
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
  let foundPath = null;
  try {
    await withClient(async (client, config) => {
      for (const path of mileswebPathCandidates(key, config)) {
        try {
          const size = await client.size(path);
          if (Number(size) > 0) {
            foundPath = path;
            return;
          }
        } catch (err) {
          if (!isMissingFileError(err)) throw err;
        }
      }
    });
  } catch {
    foundPath = null;
  }
  existsCache.set(key, { ok: Boolean(foundPath), path: foundPath, at: Date.now() });
  return Boolean(foundPath);
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
    // ensureDir changes the working directory. Upload and size-check from
    // the account root so the file lands on the path later reads use.
    await client.cd('/');
    if (dir) await client.ensureDir(dir);
    await client.cd('/');
    await client.uploadFrom(Readable.from(bytes), full);
    const size = await client.size(full);
    if (!(Number(size) > 0)) {
      throw new Error('MilesWeb upload did not store the image');
    }
  });
  rememberMileswebObject(key);
  return { key };
}

export async function readMileswebObject(key) {
  if (!isAllowedUploadKey(key) || !isMileswebStorageEnabled()) return null;
  try {
    return await withClient(async (client, config) => {
      const cached = existsCache.get(key);
      const paths = [...new Set([
        ...(cached?.path ? [cached.path] : []),
        ...mileswebPathCandidates(key, config),
      ])];
      for (const path of paths) {
        try {
          const chunks = [];
          const sink = new Writable({
            write(chunk, _enc, callback) {
              chunks.push(Buffer.from(chunk));
              callback();
            },
          });
          await client.downloadTo(sink, path);
          const bytes = Buffer.concat(chunks);
          if (!bytes.length || bytes.length > 8 * 1024 * 1024) continue;
          existsCache.set(key, { ok: true, path, at: Date.now() });
          return bytes;
        } catch (err) {
          if (!isMissingFileError(err)) throw err;
        }
      }
      return null;
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
