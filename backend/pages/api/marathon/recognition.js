import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { handleGetRecognition, handleMarkRecognitionViewed } from '../../../features/marathon/api/recognition.handler.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, POST, OPTIONS')) return;
  if (req.method === 'GET')  return runService(res, () => handleGetRecognition(req.query));
  if (req.method === 'POST') return runService(res, () => handleMarkRecognitionViewed(req.body));
  return methodNotAllowed(res);
}
