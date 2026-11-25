export const GBP_FLAG = 'ff.gbp-listing';

export const GBP_STATUS = Object.freeze({
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  IN_PROGRESS: 'in_progress',
  LIVE: 'live',
  NEEDS_INFO: 'needs_info',
  CANCELLED: 'cancelled',
});

export const GBP_CATEGORIES = Object.freeze([
  'Nutritionist',
  'Health consultant',
  'Wellness center',
  'Weight loss service',
]);

export const WEEKDAYS = Object.freeze([
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
]);

export function isGbpAdminRole(role) {
  const r = String(role || '').toLowerCase();
  return r === 'admin' || r === 'developer';
}

export function statusLabel(status) {
  switch (String(status || '')) {
    case GBP_STATUS.DRAFT: return 'Draft';
    case GBP_STATUS.SUBMITTED: return 'Submitted';
    case GBP_STATUS.IN_PROGRESS: return 'In progress';
    case GBP_STATUS.LIVE: return 'Live';
    case GBP_STATUS.NEEDS_INFO: return 'Needs info';
    case GBP_STATUS.CANCELLED: return 'Cancelled';
    default: return 'Draft';
  }
}

export function emptyGbpForm() {
  return {
    businessName: '',
    primaryCategory: '',
    streetAddress: '',
    landmark: '',
    area: '',
    city: '',
    state: 'Tamil Nadu',
    pincode: '',
    showAddress: true,
    phone: '',
    whatsapp: '',
    websiteUrl: '',
    workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    openingTime: '07:00',
    closingTime: '19:00',
    weeklyHoliday: 'Sunday',
    description: '',
  };
}
