import { largeBodyConfig as config } from '../../../utils/apiConfig.js';
import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { validateSave, validateList, validateDelete } from '../../../features/background-analysis/analysis.validators.js';
import { save, list, deleteAnalysis } from '../../../features/background-analysis/analysis.service.js';
import { convertToIST, getISTTimestamp } from '../../../utils/supabaseClient.js';
import logger from '../../../shared/lib/logger.js';

export { config };

function deriveIstTimestampFromAnalysisInput(input) {
  if (input.clientTimestamp) {
    return convertToIST(input.clientTimestamp).istTimestamp.substring(0, 19);
  }
  return getISTTimestamp().substring(0, 19);
}

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, POST, DELETE, OPTIONS')) return;
  if (req.method === 'POST') {
    return runService(res, async () => {
      const input = validateSave(req.body);
      const result = await save(input);

      return result;
    });
  }
  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    return runService(res, () => list(validateList(req.query)));
  }
  if (req.method === 'DELETE') {
    return runService(res, () => deleteAnalysis(validateDelete(req.body)));
  }
  return methodNotAllowed(res);
}
