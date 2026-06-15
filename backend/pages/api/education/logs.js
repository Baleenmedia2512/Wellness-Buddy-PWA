import { largeBodyConfig as config } from '../../../utils/apiConfig.js';
import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { validateSaveLog, validateGetLogs, validateDeleteLog } from '../../../features/education/education.validators.js';
import { saveLog, listLogs, deleteLog } from '../../../features/education/education.service.js';
import { recordCompletionLearning } from '../../../features/tasks/api/record-completion-learning.handler.js';
import { convertToIST, getISTTimestamp } from '../../../utils/supabaseClient.js';
import logger from '../../../shared/lib/logger.js';

export { config };

function deriveIstTimestampFromEducationInput(input) {
  if (input.imageTimestamp) {
    return convertToIST(input.imageTimestamp).istTimestamp.substring(0, 19);
  }
  return getISTTimestamp().substring(0, 19);
}

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, POST, DELETE, OPTIONS')) return;
  if (req.method === 'POST') {
    return runService(res, async () => {
      const input = validateSaveLog(req.body);
      const result = await saveLog(input);

      if (result.httpStatus === 200 && result.body?.success) {
        const istTimestamp = result.body.logTimestamp
          ? String(result.body.logTimestamp).substring(0, 19)
          : deriveIstTimestampFromEducationInput(input);

        recordCompletionLearning({
          userId: input.userId,
          taskType: 'education',
          istTimestamp,
          completionData: { activity: input.topic || 'education' },
        }).catch((err) =>
          logger.error('education save: habit learning failed (non-critical)', {
            userId: input.userId,
            error: err.message,
          })
        );
      }

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
