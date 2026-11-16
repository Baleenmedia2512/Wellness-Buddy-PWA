import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { ValidationError } from '../../../shared/lib/ValidationError.js';
import { getClientAppVersion } from '../../../shared/lib/client-app-version.js';
import {
  getPrompts,
  recordPromptAction,
} from '../../../features/field-collection/field-collection.service.js';
import { FIELD_KEYS } from '../../../features/field-collection/domain/fieldCollection.rules.js';

function requireUserId(raw) {
  if (raw == null || String(raw).trim() === '') {
    throw new ValidationError(400, 'userId is required');
  }
  return String(raw).trim();
}

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, POST, OPTIONS')) return;
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'GET') {
    const deferKeys = String(req.query?.defer || '')
      .split(',')
      .map((key) => key.trim())
      .filter((key) => FIELD_KEYS.includes(key));
    return runService(res, () => getPrompts({
      userId: requireUserId(req.query?.userId),
      appVersion: getClientAppVersion(req),
      deferKeys,
    }));
  }
  if (req.method === 'POST') {
    const body = req.body || {};
    return runService(res, () => recordPromptAction({
      userId: requireUserId(body.userId),
      fieldKey: String(body.fieldKey || ''),
      action: String(body.action || ''),
      appVersion: getClientAppVersion(req),
    }));
  }
  return methodNotAllowed(res);
}
