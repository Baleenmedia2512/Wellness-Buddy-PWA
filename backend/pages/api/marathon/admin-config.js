import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { handleGetAdminConfig, handleSaveAdminConfig } from '../../../features/marathon/api/admin-config.handler.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, POST, OPTIONS')) return;
  if (req.method === 'GET')  return runService(res, () => handleGetAdminConfig(req.query));
  if (req.method === 'POST') return runService(res, () => handleSaveAdminConfig(req.body));
  return methodNotAllowed(res);
}
