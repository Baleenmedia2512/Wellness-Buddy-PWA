import { largeBodyConfig as config } from '../../../utils/apiConfig.js';
import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { validateSaveLog, validateGetLogs, validateDeleteLog } from '../../../features/education/education.validators.js';
import { saveLog, listLogs, deleteLog } from '../../../features/education/education.service.js';
import logger from '../../../shared/lib/logger.js';

export { config };

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, POST, DELETE, OPTIONS')) return;
  if (req.method === 'POST') {
    return runService(res, async () => {
      const input = validateSaveLog(req.body);
      const result = await saveLog(input);

      return result;
    });
  }
  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    return runService(res, () => listLogs(validateGetLogs(req.query)));
  }
  if (req.method === 'DELETE') {
    return runService(res, () => deleteLog(validateDeleteLog(req.body)));
  }
  return methodNotAllowed(res);
}
