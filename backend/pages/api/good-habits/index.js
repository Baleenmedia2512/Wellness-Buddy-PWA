import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import {
  validateSaveHabit,
  validateGetHabitImage,
  validateDeleteHabit,
} from '../../../features/good-habits/validation/save.schema.js';
import {
  saveHabit,
  getHabitImage,
  deleteHabit,
  undoDeleteHabit,
} from '../../../features/good-habits/api/save.handler.js';
import { deleteById as deleteCaptureById } from '../../../features/captures/captures.service.js';
import { isEnabled } from '../../../shared/lib/feature-flags.js';
import logger from '../../../shared/lib/logger.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

function flagOff() {
  return {
    httpStatus: 404,
    body: { ok: false, error: { code: 'FLAG_OFF', message: 'Good Habit is not enabled' } },
  };
}

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, POST, DELETE, OPTIONS')) return;

  if (!isEnabled('ff.good-habit')) {
    return runService(res, async () => flagOff());
  }

  if (req.method === 'POST') {
    const undo = req.body?.undo === true || req.query?.undo === '1';
    if (undo) {
      return runService(res, () => undoDeleteHabit(validateDeleteHabit(req.body)));
    }
    return runService(res, async () => {
      const input = validateSaveHabit(req.body);
      const result = await saveHabit(input);
      if (input.captureId) {
        try {
          await deleteCaptureById({
            captureId: input.captureId,
            userId: input.userId,
          });
        } catch (err) {
          logger.warn('good-habits: failed to discard original capture', {
            captureId: input.captureId,
            err: err.message,
          });
        }
      }
      return result;
    });
  }
  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'private, max-age=300');
    const input = validateGetHabitImage(req.query);
    if (input.slot) {
      const { sendImageRedirect } = await import('../../../shared/lib/r2/sendImageRedirect.js');
      const result = await getHabitImage(input);
      if (result.httpStatus !== 200) {
        return res.status(result.httpStatus).json(result.body);
      }
      if (sendImageRedirect(res, result.body?.r2Url)) return;
      return res.status(404).json({ success: false, message: 'No image' });
    }
    return runService(res, () => getHabitImage(input));
  }
  if (req.method === 'DELETE') {
    return runService(res, () => deleteHabit(validateDeleteHabit(req.body)));
  }
  return methodNotAllowed(res);
}
