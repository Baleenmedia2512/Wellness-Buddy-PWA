import { ValidationError } from '../../shared/lib/ValidationError.js';

export function validateDetectFace(body) {
  const { imageBase64 } = body || {};
  if (!imageBase64 || typeof imageBase64 !== 'string') {
    throw new ValidationError(400, 'imageBase64 is required');
  }
  return { imageBase64 };
}

export function validateClubAttendance(query) {
  if (!query?.userId) throw new ValidationError(400, 'Missing required parameter: userId');
  return {
    userId: parseInt(query.userId, 10),
    startDate: query.startDate || null,
    endDate: query.endDate || null,
  };
}
