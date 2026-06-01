import { ValidationError } from '../../shared/lib/ValidationError.js';

export function validateCheckName(query) {
  // Empty / short names → service responds available:true; we still pass through
  return { name: (query?.name || '').trim() };
}

export function validateGetCenters(query) {
  if (!query?.userId) throw new ValidationError(400, 'Missing required parameter: userId');
  return {
    userId: query.userId,
    teamFilter: query.teamFilter || 'direct',
    scope: query.scope || 'team',
    dateRange: query.dateRange || 'today',
    startDate: query.startDate,
    endDate: query.endDate,
  };
}

export function validateRegister(body) {
  if (!body) throw new ValidationError(400, 'Request body is missing');
  const { centerName, latitude, longitude, ownerUserId } = body;
  if (!centerName || !latitude || !longitude || !ownerUserId) {
    throw new ValidationError(
      400,
      'Missing required fields: centerName, latitude, longitude, ownerUserId',
    );
  }
  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new ValidationError(400, 'Invalid coordinates');
  }
  return { ...body, latitude: lat, longitude: lng };
}

export function validateUnregister(body) {
  if (!body) throw new ValidationError(400, 'Request body is missing');
  const { centerId, userId } = body;
  if (!centerId || !userId) {
    throw new ValidationError(400, 'Missing required fields: centerId, userId');
  }
  return { centerId, userId };
}

export function validateUpdate(body) {
  if (!body) throw new ValidationError(400, 'Request body is missing');
  const { centerId, userId, centerName, latitude, longitude, ownerPhone, educationHour } = body;
  if (!centerId) throw new ValidationError(400, 'Missing required field: centerId');
  if (!userId) throw new ValidationError(400, 'Missing required field: userId');
  const hasAtLeastOneField = centerName !== undefined
    || latitude !== undefined
    || longitude !== undefined
    || ownerPhone !== undefined
    || educationHour !== undefined;
  if (!hasAtLeastOneField) {
    throw new ValidationError(400, 'At least one updatable field must be provided');
  }
  if (centerName !== undefined && !centerName.trim()) {
    throw new ValidationError(400, 'centerName cannot be empty');
  }
  if (latitude !== undefined || longitude !== undefined) {
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      throw new ValidationError(400, 'Invalid coordinates');
    }
    return { centerId, userId, centerName, latitude: lat, longitude: lng, ownerPhone, educationHour };
  }
  return { centerId, userId, centerName, latitude, longitude, ownerPhone, educationHour };
}
