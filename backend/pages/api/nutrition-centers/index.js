import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { getClientAppVersion } from '../../../shared/lib/client-app-version.js';
import {
  validateGetCenterPhotos,
  validateGetCenters,
  validateRegister,
  validateUpdate,
} from '../../../features/nutrition-centers/centers.validators.js';
import { getCenterPhotos, listCenters, register, updateCenter } from '../../../features/nutrition-centers/centers.service.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '8mb',
    },
  },
};

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, POST, PATCH, OPTIONS')) return;
  const appVersion = getClientAppVersion(req);
  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    if (String(req.query.includePhotos || '') === '1') {
      return runService(res, () => getCenterPhotos(validateGetCenterPhotos(req.query)));
    }
    return runService(res, () => listCenters(validateGetCenters(req.query)));
  }
  if (req.method === 'POST') {
    return runService(res, () => register(validateRegister(req.body, appVersion)));
  }
  if (req.method === 'PATCH') {
    return runService(res, () => updateCenter(validateUpdate(req.body, appVersion)));
  }
  return methodNotAllowed(res);
}
