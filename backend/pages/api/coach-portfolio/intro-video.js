import formidable from 'formidable';
import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { isEnabled } from '../../../shared/lib/feature-flags.js';
import { uploadIntroVideo } from '../../../features/coach-portfolio/api/intro-video.handler.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

function parseMultipart(req) {
  const form = formidable({
    maxFileSize: 80 * 1024 * 1024,
    multiples: false,
  });
  return new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });
}

function firstField(value) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function firstFile(value) {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] || null;
  return value;
}

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (!isEnabled('ff.coach-portfolio')) {
    return res.status(404).json({ ok: false, message: 'Feature not enabled' });
  }
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  if (req.method !== 'POST') return methodNotAllowed(res);

  return runService(res, async () => {
    const { fields, files } = await parseMultipart(req);
    return uploadIntroVideo({
      userId: firstField(fields.userId),
      file: firstFile(files.video) || firstFile(files.file),
    });
  });
}
