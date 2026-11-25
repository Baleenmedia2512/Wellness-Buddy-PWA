/**
 * Google Maps Listing request — statuses, categories, validation.
 */

export const GBP_FLAG = 'ff.gbp-listing';

export const GBP_STATUS = Object.freeze({
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  IN_PROGRESS: 'in_progress',
  LIVE: 'live',
  NEEDS_INFO: 'needs_info',
  CANCELLED: 'cancelled',
});

export const GBP_PRIMARY_CATEGORIES = Object.freeze([
  'Nutritionist',
  'Health consultant',
  'Wellness center',
  'Weight loss service',
]);

export const MIN_GBP_PHOTOS = 3;
export const MAX_GBP_DESCRIPTION = 500;

const OPEN_STATUSES = new Set([
  GBP_STATUS.DRAFT,
  GBP_STATUS.SUBMITTED,
  GBP_STATUS.IN_PROGRESS,
  GBP_STATUS.NEEDS_INFO,
]);

const ADMIN_EDITABLE = new Set([
  GBP_STATUS.SUBMITTED,
  GBP_STATUS.IN_PROGRESS,
  GBP_STATUS.NEEDS_INFO,
  GBP_STATUS.LIVE,
  GBP_STATUS.CANCELLED,
]);

const WEEKDAYS = Object.freeze([
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
]);

export function isOpenGbpStatus(status) {
  return OPEN_STATUSES.has(String(status || '').trim().toLowerCase());
}

export function isAdminEditableGbpStatus(status) {
  return ADMIN_EDITABLE.has(String(status || '').trim().toLowerCase());
}

export function canCoachEditRequest(status) {
  const s = String(status || '').trim().toLowerCase();
  return s === GBP_STATUS.DRAFT || s === GBP_STATUS.NEEDS_INFO;
}

export function canCoachSubmitRequest(status) {
  return canCoachEditRequest(status);
}

/**
 * @param {unknown} raw
 * @returns {string[]}
 */
export function normalizeWorkingDays(raw) {
  const list = Array.isArray(raw) ? raw : [];
  const out = [];
  const seen = new Set();
  for (const item of list) {
    const day = String(item || '').trim();
    if (!WEEKDAYS.includes(day) || seen.has(day)) continue;
    seen.add(day);
    out.push(day);
  }
  return out;
}

/**
 * @param {unknown} raw
 * @returns {Array<{ key: string, url?: string, mime?: string, bytes?: number, originalName?: string, kind?: string }>}
 */
export function normalizeMediaFiles(raw) {
  let list = raw;
  if (typeof raw === 'string') {
    try {
      list = JSON.parse(raw || '[]');
    } catch {
      list = [];
    }
  }
  if (!Array.isArray(list)) return [];
  return list
    .filter((item) => item && typeof item === 'object' && String(item.key || '').trim())
    .map((item) => ({
      key: String(item.key).trim(),
      url: item.url ? String(item.url) : '',
      mime: item.mime ? String(item.mime) : '',
      bytes: Number(item.bytes) || 0,
      originalName: item.originalName ? String(item.originalName) : '',
      kind: String(item.kind || '').toLowerCase() === 'video' ? 'video' : 'photo',
    }));
}

export function countPhotos(mediaFiles) {
  return normalizeMediaFiles(mediaFiles).filter((f) => f.kind === 'photo').length;
}

/**
 * @param {object} input
 * @returns {string[]}
 */
export function validateGbpRequestForSubmit(input = {}) {
  const errors = [];
  const name = String(input.businessName || '').trim();
  if (!name) errors.push('Business name is required');
  if (name.length > 160) errors.push('Business name is too long');

  const category = String(input.primaryCategory || '').trim();
  if (!GBP_PRIMARY_CATEGORIES.includes(category)) {
    errors.push('Pick a primary category');
  }

  const centerId = Number(input.centerId);
  if (!Number.isFinite(centerId) || centerId <= 0) {
    errors.push('Select an owned center');
  }

  if (!String(input.streetAddress || '').trim()) errors.push('Street address is required');
  if (!String(input.city || '').trim()) errors.push('City is required');
  if (!String(input.state || '').trim()) errors.push('State is required');
  if (!String(input.phone || '').trim()) errors.push('Phone is required');

  const desc = String(input.description || '').trim();
  if (desc.length > MAX_GBP_DESCRIPTION) {
    errors.push(`Description must be ${MAX_GBP_DESCRIPTION} characters or less`);
  }

  const photos = countPhotos(input.mediaFiles);
  if (photos < MIN_GBP_PHOTOS) {
    errors.push(`Upload at least ${MIN_GBP_PHOTOS} photos (name board, entrance, interior)`);
  }

  return errors;
}

/**
 * Normalize draft/submit payload fields (not status / media folder).
 * @param {object} raw
 */
export function normalizeGbpFormFields(raw = {}) {
  const workingDays = normalizeWorkingDays(raw.workingDays ?? raw.workingDaysJson);
  return {
    businessName: String(raw.businessName || '').trim().slice(0, 160),
    primaryCategory: String(raw.primaryCategory || '').trim().slice(0, 80),
    streetAddress: String(raw.streetAddress || '').trim().slice(0, 255),
    landmark: String(raw.landmark || '').trim().slice(0, 160),
    area: String(raw.area || '').trim().slice(0, 120),
    city: String(raw.city || '').trim().slice(0, 120),
    state: String(raw.state || 'Tamil Nadu').trim().slice(0, 80) || 'Tamil Nadu',
    pincode: String(raw.pincode || '').trim().slice(0, 12),
    showAddress: raw.showAddress === false || raw.showAddress === 0 || raw.showAddress === '0'
      ? false
      : true,
    phone: String(raw.phone || '').replace(/[^\d+]/g, '').slice(0, 32),
    whatsapp: String(raw.whatsapp || '').replace(/[^\d+]/g, '').slice(0, 32),
    websiteUrl: String(raw.websiteUrl || '').trim().slice(0, 320),
    workingDays,
    openingTime: String(raw.openingTime || '').trim().slice(0, 16),
    closingTime: String(raw.closingTime || '').trim().slice(0, 16),
    weeklyHoliday: String(raw.weeklyHoliday || '').trim().slice(0, 40),
    description: String(raw.description || '').trim().slice(0, MAX_GBP_DESCRIPTION),
  };
}

/**
 * Public API shape for coach + admin.
 * @param {object} row
 */
function parseWorkingDaysField(raw) {
  if (Array.isArray(raw)) return normalizeWorkingDays(raw);
  if (typeof raw === 'string' && raw.trim()) {
    try {
      return normalizeWorkingDays(JSON.parse(raw));
    } catch {
      return [];
    }
  }
  return [];
}

export function toPublicGbpRequest(row) {
  if (!row) return null;
  const mediaFiles = normalizeMediaFiles(row.mediaFiles ?? row.mediaFilesJson);
  const workingDays = parseWorkingDaysField(
    row.workingDays ?? row.workingDaysJson,
  );
  return {
    id: Number(row.id) || null,
    userId: Number(row.userId) || null,
    centerId: Number(row.centerId) || null,
    centerName: row.centerName != null ? String(row.centerName) : null,
    userName: row.userName != null ? String(row.userName) : null,
    status: String(row.status || GBP_STATUS.DRAFT),
    businessName: String(row.businessName || ''),
    primaryCategory: String(row.primaryCategory || ''),
    streetAddress: String(row.streetAddress || ''),
    landmark: String(row.landmark || ''),
    area: String(row.area || ''),
    city: String(row.city || ''),
    state: String(row.state || ''),
    pincode: String(row.pincode || ''),
    showAddress: !(row.showAddress === false || row.showAddress === 0 || row.showAddress === '0'),
    phone: String(row.phone || ''),
    whatsapp: String(row.whatsapp || ''),
    websiteUrl: String(row.websiteUrl || ''),
    workingDays,
    openingTime: String(row.openingTime || ''),
    closingTime: String(row.closingTime || ''),
    weeklyHoliday: String(row.weeklyHoliday || ''),
    description: String(row.description || ''),
    mediaFolderKey: String(row.mediaFolderKey || ''),
    mediaFiles,
    photoCount: countPhotos(mediaFiles),
    mapsUrl: row.mapsUrl ? String(row.mapsUrl) : null,
    opsNote: row.opsNote ? String(row.opsNote) : null,
    submittedAt: row.submittedAt || null,
    completedAt: row.completedAt || null,
    updatedAt: row.updatedAt || null,
    canEdit: canCoachEditRequest(row.status),
  };
}

export function mediaFolderKeyFor({ userId, requestId }) {
  return `gbp-requests/${Number(userId)}/${Number(requestId)}`;
}
