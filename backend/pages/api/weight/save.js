import { largeBodyConfig as config } from '../../../utils/apiConfig.js';
import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { validateSaveInput } from '../../../features/weight/weight.validators.js';
import { saveWeight } from '../../../features/weight/weight.service.js';
import { recordCompletionLearning } from '../../../features/tasks/api/record-completion-learning.handler.js';
import { getISTTimestamp, convertToIST } from '../../../utils/supabaseClient.js';
import logger from '../../../shared/lib/logger.js';

export { config };

function deriveIstTimestampFromWeightInput(input) {
  if (input.clientTimestamp) {
    return convertToIST(input.clientTimestamp).istTimestamp.substring(0, 19);
  }
  return getISTTimestamp().substring(0, 19);
}

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, POST, OPTIONS')) return;
  if (req.method !== 'POST') return methodNotAllowed(res);

  return runService(res, async () => {
    const input = validateSaveInput(req.body);
    const result = await saveWeight(input);

    if (result.httpStatus === 200 && result.body?.success) {
      recordCompletionLearning({
        userId: input.userId,
        taskType: 'weight',
        istTimestamp: deriveIstTimestampFromWeightInput(input),
        completionData: { weight: parseFloat(input.weight) },
      }).catch((err) =>
        logger.error('weight save: habit learning failed (non-critical)', {
          userId: input.userId,
          error: err.message,
        })
      );
    }

    return result;
  });
}
