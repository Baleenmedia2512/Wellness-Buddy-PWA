import { largeBodyConfig as config } from '../../../utils/apiConfig.js';
import {
  validateCreateCapture,
  validateUpdateCapture,
} from '../../../features/background-analysis/analysis.validators.js';
import {
  createPendingCapture,
  updateCaptureType,
} from '../../../features/background-analysis/analysis.service.js';

export { config };

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, PATCH, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization'
  );

  // Handle Preflight Request
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    switch (req.method) {
      case 'POST': {
        const data = validateCreateCapture(req.body);
        const result = await createPendingCapture(data);
        return res.status(200).json(result);
      }

      case 'PATCH': {
        const data = validateUpdateCapture(req.body);
        const result = await updateCaptureType(data);
        return res.status(200).json(result);
      }

      default:
        res.setHeader('Allow', ['POST', 'PATCH', 'OPTIONS']);
        return res.status(405).json({
          success: false,
          message: `Method ${req.method} Not Allowed`,
        });
    }
  } catch (error) {
    console.error(error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Internal Server Error',
    });
  }
}