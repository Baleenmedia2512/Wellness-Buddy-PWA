/**
 * Coach Website form submission statuses and helpers.
 */

import { DEFAULT_PORTFOLIO_OFFERINGS } from './default-offerings.rules.js';

export const SUBMISSION_STATUS = Object.freeze({
  DRAFT: 'draft',
  NEW: 'new',
  UNDER_REVIEW: 'under_review',
  INFORMATION_REQUIRED: 'information_required',
  APPROVED: 'approved',
  WEBSITE_IN_PROGRESS: 'website_in_progress',
  COMPLETED: 'completed',
});

export const ADMIN_EDITABLE_STATUSES = Object.freeze([
  SUBMISSION_STATUS.NEW,
  SUBMISSION_STATUS.UNDER_REVIEW,
  SUBMISSION_STATUS.INFORMATION_REQUIRED,
  SUBMISSION_STATUS.APPROVED,
  SUBMISSION_STATUS.WEBSITE_IN_PROGRESS,
  SUBMISSION_STATUS.COMPLETED,
]);

export function isValidSubmissionStatus(status) {
  return Object.values(SUBMISSION_STATUS).includes(String(status || '').trim());
}

export function isAdminEditableStatus(status) {
  return ADMIN_EDITABLE_STATUSES.includes(String(status || '').trim());
}

/**
 * Paid coaches may edit FormJson anytime (photos, copy, hours) — like a site CMS.
 * Admin status still tracks review/publish; edits must not force a downgrade to draft.
 * @param {string|null|undefined} _status
 */
export function coachCanEditSubmission(_status) {
  return true;
}

export function emptyPortfolioForm() {
  return {
    personal: {
      fullName: '',
      professionalTitle: '',
      professionalTitleOther: '',
      yearsExperience: '',
      background: '',
      qualifications: '',
      languages: [],
      languagesOther: '',
      uniqueApproach: '',
      profilePhoto: null,
    },
    center: {
      centerName: '',
      operational: '',
      expectedOpeningDate: '',
      address: '',
      locality: '',
      city: '',
      state: '',
      pincode: '',
      mapsLink: '',
      landmark: '',
      businessPhone: '',
      whatsapp: '',
      businessEmail: '',
      hasGoogleBusiness: '',
      googleBusinessLink: '',
    },
    timings: {
      workingDays: [],
      openingTime: '',
      closingTime: '',
      weeklyHoliday: '',
      weekendAppointments: '',
      advanceBookingRequired: '',
    },
    services: {
      offerings: [...DEFAULT_PORTFOLIO_OFFERINGS],
      offeringsOther: '',
      description: '',
      sessionTypes: [],
      needsAppointment: '',
      onlineConsultation: '',
      chargesFees: '',
      feeDetails: '',
      targetCustomers: [],
      targetCustomersOther: '',
      customerGoals: '',
      serviceAreas: '',
    },
    mediaBrand: {
      entrancePhoto: null,
      interiorPhotos: [],
      nameBoardPhoto: null,
      activityPhotos: [],
      introVideos: [],
      introVideoLink: '',
      introVideoKey: null,
      introVideoUrl: null,
      hasTestimonialsPermission: '',
      transformations: [],
      testimonials: [],
      websiteDisplayName: '',
      hasLogo: '',
      logo: null,
      preferredColors: [],
      preferredColorsOther: '',
      referenceWebsite: '',
      websiteLanguages: [],
      websiteLanguagesOther: '',
      social: {
        instagram: '',
        facebook: '',
        youtube: '',
        existingWebsite: '',
      },
    },
    goalsConsent: {
      websiteGoals: [],
      requiredFeatures: [],
      preferredActions: [],
      highlight: '',
      additionalRequirements: '',
      accuracyConfirmed: false,
      publishAuthorized: '',
    },
  };
}

/**
 * Before/After transformation photos (visual proof). Separate from text reviews.
 * @param {unknown} raw
 * @returns {{ label: string, beforePhotoUrl: string|null, afterPhotoUrl: string|null }[]}
 */
export function normalizeTransformations(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 6)
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const label = String(item.label || item.name || '').trim();
      const beforePhotoUrl = item.beforePhotoUrl != null ? String(item.beforePhotoUrl) : null;
      const afterPhotoUrl = item.afterPhotoUrl != null ? String(item.afterPhotoUrl) : null;
      if (!beforePhotoUrl && !afterPhotoUrl) return null;
      return { label, beforePhotoUrl, afterPhotoUrl };
    })
    .filter(Boolean);
}

/**
 * Clamp review stars to 1–5. Missing / invalid → 5 (legacy rows had no rating).
 * @param {unknown} raw
 * @returns {number}
 */
export function normalizeReviewRating(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 5;
  return Math.min(5, Math.max(1, Math.round(n)));
}

/**
 * Opening/closing for `<input type="time">` — strict 24h `HH:mm` only.
 * Legacy text like "07:00 AM" is not a real form fill (time inputs cannot
 * store that) and must not appear on the public site.
 * @param {unknown} raw
 * @returns {string}
 */
export function normalizeClockTime(raw) {
  const text = String(raw || '').trim();
  if (!text) return '';
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/.exec(text);
  if (!match) return '';
  return `${match[1]}:${match[2]}`;
}

/**
 * Public label for a normalized clock time (`09:00` → `09:00 AM`).
 * @param {unknown} raw
 * @returns {string}
 */
export function formatClockTimeLabel(raw) {
  const hhmm = normalizeClockTime(raw);
  if (!hhmm) return '';
  const [hStr, mStr] = hhmm.split(':');
  let hour = Number(hStr);
  const minutes = mStr;
  const suffix = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12;
  if (hour === 0) hour = 12;
  return `${String(hour).padStart(2, '0')}:${minutes} ${suffix}`;
}

/**
 * Real client reviews (name + quote + optional rating). No fake demo quotes.
 * Legacy before/after on a testimonial row migrates into photos if present,
 * but public reviews use name/quote/rating.
 * @param {unknown} raw
 * @returns {{ name: string, quote: string, rating: number }[]}
 */
export function normalizeTestimonials(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 6)
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const name = String(item.name || '').trim();
      const quote = String(item.quote || '').trim();
      if (!name && !quote) return null;
      return {
        name,
        quote,
        rating: normalizeReviewRating(item.rating),
      };
    })
    .filter(Boolean);
}

/**
 * @param {unknown} raw
 * @returns {object}
 */
export function normalizeFormJson(raw) {
  const base = emptyPortfolioForm();
  if (!raw || typeof raw !== 'object') return base;
  const timingsIn = { ...base.timings, ...(raw.timings || {}) };
  return {
    personal: { ...base.personal, ...(raw.personal || {}) },
    center: { ...base.center, ...(raw.center || {}) },
    timings: {
      ...timingsIn,
      openingTime: normalizeClockTime(timingsIn.openingTime),
      closingTime: normalizeClockTime(timingsIn.closingTime),
    },
    services: { ...base.services, ...(raw.services || {}) },
    mediaBrand: {
      ...base.mediaBrand,
      ...(raw.mediaBrand || {}),
      interiorPhotos: Array.isArray(raw.mediaBrand?.interiorPhotos)
        ? raw.mediaBrand.interiorPhotos.filter(Boolean)
        : [],
      activityPhotos: Array.isArray(raw.mediaBrand?.activityPhotos)
        ? raw.mediaBrand.activityPhotos.filter(Boolean)
        : [],
      introVideos: (() => {
        const listed = Array.isArray(raw.mediaBrand?.introVideos)
          ? raw.mediaBrand.introVideos.filter(Boolean).map((u) => String(u))
          : [];
        if (listed.length) return listed;
        const legacy = String(
          raw.mediaBrand?.introVideoUrl || raw.mediaBrand?.introVideoLink || '',
        ).trim();
        return legacy ? [legacy] : [];
      })(),
      // Keep legacy single fields in sync with the first multi video.
      introVideoUrl: (() => {
        const listed = Array.isArray(raw.mediaBrand?.introVideos)
          ? raw.mediaBrand.introVideos.filter(Boolean).map((u) => String(u))
          : [];
        if (listed.length) return listed[0];
        return String(raw.mediaBrand?.introVideoUrl || '').trim() || null;
      })(),
      introVideoLink: (() => {
        const listed = Array.isArray(raw.mediaBrand?.introVideos)
          ? raw.mediaBrand.introVideos.filter(Boolean).map((u) => String(u))
          : [];
        if (listed.length) return listed[0];
        return String(
          raw.mediaBrand?.introVideoLink || raw.mediaBrand?.introVideoUrl || '',
        ).trim();
      })(),
      transformations: normalizeTransformations(raw.mediaBrand?.transformations),
      testimonials: normalizeTestimonials(raw.mediaBrand?.testimonials),
      social: {
        ...base.mediaBrand.social,
        ...(raw.mediaBrand?.social || {}),
      },
    },
    goalsConsent: { ...base.goalsConsent, ...(raw.goalsConsent || {}) },
  };
}

function requireText(value, label, errors) {
  if (!String(value || '').trim()) errors.push(`${label} is required`);
}

/**
 * Required fields for final submit (v1). Drafts skip this.
 * Club name is required only when the coach owns a club (Hours / map apply then).
 * @param {object} form
 * @param {{ hasClub?: boolean }} [opts]
 * @returns {string[]}
 */
export function validateFormForSubmit(form, { hasClub = false } = {}) {
  const errors = [];
  const f = normalizeFormJson(form);
  // Profile / club / contact / default programs hydrate from the app.
  // Only require fields that still need a human or a successful hydrate.
  requireText(f.personal.fullName, 'Full name (from your app profile)', errors);
  requireText(f.personal.professionalTitle, 'Professional title', errors);
  // About step — all mandatory for publish.
  requireText(f.personal.yearsExperience, 'Years of experience', errors);
  requireText(f.personal.background, 'Who are you as a Wellness Professional', errors);
  requireText(f.personal.uniqueApproach, 'What do you believe in', errors);
  if (!Array.isArray(f.personal.languages) || f.personal.languages.length === 0) {
    errors.push('Languages is required');
  } else if (
    f.personal.languages.includes('Other')
    && !String(f.personal.languagesOther || '').trim()
  ) {
    errors.push('Other language is required');
  }
  if (hasClub) {
    requireText(f.center.centerName, 'Wellness center name (from your club)', errors);
  }
  requireText(f.center.businessPhone, 'Contact number (from your app profile)', errors);
  requireText(f.mediaBrand.websiteDisplayName, 'Website display name', errors);
  if (f.goalsConsent.accuracyConfirmed !== true) {
    errors.push('Confirm that the information is accurate');
  }
  if (String(f.goalsConsent.publishAuthorized || '') !== 'yes') {
    errors.push('Authorize use of submitted content for website publication');
  }
  return errors;
}

/** About-step completeness for form Next / Publish UX. */
export function validateAboutStep(form) {
  const errors = [];
  const f = normalizeFormJson(form);
  requireText(f.personal.yearsExperience, 'Years of experience', errors);
  requireText(f.personal.background, 'Who are you as a Wellness Professional', errors);
  requireText(f.personal.uniqueApproach, 'What do you believe in', errors);
  if (!Array.isArray(f.personal.languages) || f.personal.languages.length === 0) {
    errors.push('Languages is required');
  } else if (
    f.personal.languages.includes('Other')
    && !String(f.personal.languagesOther || '').trim()
  ) {
    errors.push('Other language is required');
  }
  return errors;
}

/**
 * True when draft FormJson differs from the live PublishedFormJson snapshot.
 * First publish (no snapshot yet) counts as unpublished changes when a draft exists.
 */
export function hasUnpublishedFormChanges(row) {
  if (!row) return false;
  const isPublished = row.isPublished === true || Number(row.isPublished) === 1;
  if (!isPublished) return false;
  const draft = normalizeFormJson(row.formJson);
  const published = row.publishedFormJson != null
    ? normalizeFormJson(row.publishedFormJson)
    : null;
  // Live site with no snapshot yet (pre-migration) — treat draft as pending until next publish.
  if (!published) return true;
  try {
    return JSON.stringify(draft) !== JSON.stringify(published);
  } catch {
    return true;
  }
}

/** Form used to render the public /coach page (live snapshot, legacy fallback). */
export function resolveLiveFormJson(row) {
  if (!row) return normalizeFormJson({});
  if (row.publishedFormJson != null) return normalizeFormJson(row.publishedFormJson);
  return normalizeFormJson(row.formJson);
}

export function toPublicSubmission(row, { includeForm = true } = {}) {
  if (!row) return null;
  const form = includeForm ? normalizeFormJson(row.formJson) : undefined;
  const publicSlug = row.publicSlug ? String(row.publicSlug) : null;
  const isPublished = row.isPublished === true || Number(row.isPublished) === 1;
  return {
    id: row.id != null ? Number(row.id) : null,
    userId: Number(row.userId),
    centerId: row.centerId != null ? Number(row.centerId) : null,
    userName: row.userName != null ? String(row.userName) : null,
    status: String(row.status || SUBMISSION_STATUS.DRAFT),
    adminNote: row.adminNote != null ? String(row.adminNote) : null,
    publicSlug,
    isPublished,
    hasUnpublishedChanges: hasUnpublishedFormChanges(row),
    publicPath: publicSlug ? `/coach/${publicSlug}` : null,
    submittedAt: row.submittedAt ? String(row.submittedAt) : null,
    reviewedAt: row.reviewedAt ? String(row.reviewedAt) : null,
    updatedAt: row.updatedAt ? String(row.updatedAt) : null,
    ...(includeForm ? { form } : {}),
  };
}
