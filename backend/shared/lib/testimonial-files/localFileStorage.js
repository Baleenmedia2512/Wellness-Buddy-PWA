/**
 * Testimonial files (before/after photos, share cards, videos) when MySQL
 * storage is not configured. Paths stay `{userId}/{file}` so existing rows
 * keep the same shape. MilesWeb FTP is a later copy; this disk is what the
 * local API can read immediately.
 */
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

const SAFE_PATH = /^[0-9]+\/[A-Za-z0-9._-]+$/;

export function testimonialFileRoot(env = process.env) {
  const configured = String(env.TESTIMONIAL_FILE_DIR || '').trim();
  if (configured) return configured;
  return path.join(process.cwd(), 'data', 'testimonial-files');
}

export function testimonialFileBaseUrl(env = process.env) {
  const configured = String(env.TESTIMONIAL_FILE_BASE_URL || '').trim().replace(/\/+$/, '');
  return configured || 'http://localhost:3000';
}

function signingKey(env = process.env) {
  return String(env.CRON_SECRET || env.TESTIMONIAL_FILE_SECRET || 'local-testimonial-files');
}

export function assertSafeTestimonialPath(filePath) {
  const normalized = String(filePath || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!SAFE_PATH.test(normalized) || normalized.includes('..')) {
    throw new Error('Invalid testimonial file path');
  }
  return normalized;
}

function absolutePath(filePath, env = process.env) {
  const safe = assertSafeTestimonialPath(filePath);
  const root = path.resolve(testimonialFileRoot(env));
  const full = path.resolve(root, safe);
  if (!full.startsWith(root + path.sep)) {
    throw new Error('Invalid testimonial file path');
  }
  return full;
}

export function signTestimonialFilePath(filePath, expiresAtMs, env = process.env) {
  const safe = assertSafeTestimonialPath(filePath);
  return crypto
    .createHmac('sha256', signingKey(env))
    .update(`${safe}.${expiresAtMs}`)
    .digest('hex')
    .slice(0, 32);
}

export function verifyTestimonialFileRequest(filePath, expiresAtMs, signature, env = process.env, now = Date.now()) {
  if (!filePath || !signature || !Number.isFinite(expiresAtMs) || expiresAtMs < now) return false;
  let expected = '';
  try {
    expected = signTestimonialFilePath(filePath, expiresAtMs, env);
  } catch {
    return false;
  }
  const given = Buffer.from(String(signature));
  const wanted = Buffer.from(expected);
  if (given.length !== wanted.length) return false;
  return crypto.timingSafeEqual(given, wanted);
}

export function testimonialFileUrl(filePath, expiresSeconds, env = process.env) {
  const safe = assertSafeTestimonialPath(filePath);
  const expiresAtMs = Date.now() + (Number(expiresSeconds) || 1800) * 1000;
  const sig = signTestimonialFilePath(safe, expiresAtMs, env);
  const base = testimonialFileBaseUrl(env);
  const query = new URLSearchParams({
    path: safe,
    exp: String(expiresAtMs),
    sig,
  });
  return `${base}/api/testimonials/file?${query.toString()}`;
}

async function readBytes(filePath, env) {
  try {
    const bytes = await fs.readFile(absolutePath(filePath, env));
    if (!bytes.length || bytes.length > 80 * 1024 * 1024) return null;
    return bytes;
  } catch {
    return null;
  }
}

export function createLocalFileStorage(env = process.env) {
  return {
    from() {
      return {
        async upload(filePath, body) {
          try {
            const full = absolutePath(filePath, env);
            await fs.mkdir(path.dirname(full), { recursive: true });
            const bytes = Buffer.isBuffer(body) ? body : Buffer.from(body);
            await fs.writeFile(full, bytes);
            return { data: { path: assertSafeTestimonialPath(filePath) }, error: null };
          } catch (err) {
            return { data: null, error: { message: err?.message || 'Local file upload failed' } };
          }
        },
        async download(filePath) {
          const bytes = await readBytes(filePath, env);
          if (!bytes) return { data: null, error: { message: 'File not found' } };
          return { data: { arrayBuffer: async () => bytes }, error: null };
        },
        async remove(paths) {
          const list = Array.isArray(paths) ? paths : [];
          await Promise.all(list.map(async (filePath) => {
            try {
              await fs.unlink(absolutePath(filePath, env));
            } catch {
              /* already gone */
            }
          }));
          return { data: null, error: null };
        },
        async list(folder, options = {}) {
          try {
            const safeFolder = assertSafeTestimonialPath(`${folder}/placeholder.jpg`).split('/')[0];
            const dir = path.join(testimonialFileRoot(env), safeFolder);
            const names = await fs.readdir(dir);
            const search = String(options.search || '');
            const matched = names
              .filter((name) => !search || name.includes(search))
              .slice(0, Number(options.limit) || names.length)
              .map((name) => ({ name }));
            return { data: matched, error: null };
          } catch {
            return { data: [], error: null };
          }
        },
        async createSignedUrl(filePath, expiresSeconds) {
          try {
            const signedUrl = testimonialFileUrl(filePath, expiresSeconds, env);
            return { data: { signedUrl }, error: null };
          } catch (err) {
            return { data: null, error: { message: err?.message || 'Could not sign file URL' } };
          }
        },
        getPublicUrl(filePath) {
          try {
            return { data: { publicUrl: testimonialFileUrl(filePath, 3600, env) } };
          } catch {
            return { data: { publicUrl: '' } };
          }
        },
      };
    },
  };
}

export async function readTestimonialFile(filePath, env = process.env) {
  return readBytes(filePath, env);
}
