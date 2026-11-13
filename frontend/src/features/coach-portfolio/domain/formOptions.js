/** True when a select/multi value includes the Other option. */
export function includesOther(value) {
  if (Array.isArray(value)) return value.includes('Other');
  return String(value || '').trim() === 'Other';
}

export const PROFESSIONAL_TITLES = [
  'Wellness Coach',
  'Nutrition Coach',
  'Weight Management Coach',
  'Lifestyle Coach',
  'Other',
];

export const YEARS_EXPERIENCE = [
  'Less than 1 year',
  '1–3 years',
  '3–5 years',
  '5–10 years',
  'More than 10 years',
];

export const LANGUAGES = ['Tamil', 'English', 'Hindi', 'Telugu', 'Other'];

export const WEEK_DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

/** Default website services = Wellness University programs minus Extra Income + Product Cost. */
export const DEFAULT_PORTFOLIO_OFFERINGS = [
  'Family Healthy Breakfast Programme',
  'Weight Loss',
  'Weight Gain',
  'Kids Nutrition',
  'Sports Nutrition',
  'Targeted Nutrition',
];

/** @deprecated Prefer DEFAULT_PORTFOLIO_OFFERINGS — kept for older MultiCheck imports. */
export const SERVICE_OFFERINGS = [...DEFAULT_PORTFOLIO_OFFERINGS];

export const SESSION_TYPES = ['Individual Sessions', 'Group Sessions', 'Both'];

export const TARGET_CUSTOMERS = [
  'Adults interested in a healthy lifestyle',
  'People interested in weight management',
  'People looking for nutrition education',
  'Working Professionals',
  'Families',
  'Fitness Enthusiasts',
  'Other',
];

export const COLOR_THEMES = [
  'Green & White',
  'Dark Green & Cream',
  'Blue & White',
  'Orange & White',
  'Other',
];

export const WEBSITE_LANGUAGES = ['English', 'Tamil', 'Tamil + English', 'Other'];

export const WEBSITE_GOALS = [
  'Build Professional Brand',
  'Get More Customer Enquiries',
  'Improve Google Visibility',
  'Receive WhatsApp Enquiries',
  'Appointment Bookings',
  'Showcase Services',
];

export const WEBSITE_FEATURES = [
  'WhatsApp Chat Button',
  'Direct Call Button',
  'Google Maps Integration',
  'Appointment Booking',
  'Contact Form',
  'Customer Testimonials',
  'Photo Gallery',
  'Services Section',
  'FAQ Section',
  'Blog / Wellness Articles',
  'Google Reviews Integration',
];

export const PREFERRED_ACTIONS = [
  'Call Me',
  'WhatsApp Me',
  'Visit My Center',
  'Book an Appointment',
  'Submit an Enquiry',
];

/**
 * Step order for the CMS form.
 * Profile photo, club, contact, professional title, about me, joining date → years,
 * languages, qualifications, and social links come from Profile — not asked here.
 * Hours live under City & Area when a center is linked (no separate step).
 */
export const FORM_STEPS = [
  { id: 'hero', title: 'Hero', description: 'City & area' },
  { id: 'photos', title: 'Photos', description: 'Albums + intro video' },
  { id: 'review', title: 'Publish', description: 'Publish live — edit anytime after' },
];

/** Form steps for this coach. `hasClub` kept for callers; hours are inline on Hero. */
export function getFormSteps({ hasClub: _hasClub = false } = {}) {
  return FORM_STEPS;
}

export const ADMIN_STATUS_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'information_required', label: 'Information Required' },
  { value: 'approved', label: 'Approved' },
  { value: 'website_in_progress', label: 'Website In Progress' },
  { value: 'completed', label: 'Completed' },
];
