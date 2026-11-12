import { DEFAULT_PORTFOLIO_OFFERINGS } from './formOptions.js';

export function emptyPortfolioForm() {
  return {
    personal: {
      fullName: '',
      professionalTitle: 'Wellness Coach',
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

/** About step — all fields required before Next / Publish. */
export function validateAboutForm(form) {
  const errors = [];
  const personal = form?.personal || {};
  if (!String(personal.yearsExperience || '').trim()) errors.push('Years of experience is required');
  if (!String(personal.background || '').trim()) {
    errors.push('Who are you as a Wellness Professional is required');
  }
  if (!String(personal.uniqueApproach || '').trim()) {
    errors.push('What do you believe in is required');
  }
  if (!Array.isArray(personal.languages) || personal.languages.length === 0) {
    errors.push('Languages is required');
  } else if (
    personal.languages.includes('Other')
    && !String(personal.languagesOther || '').trim()
  ) {
    errors.push('Other language is required');
  }
  return errors;
}

/** Strict HH:mm for time inputs — drop legacy "07:00 AM" style strings. */
function normalizeClockTime(raw) {
  const text = String(raw || '').trim();
  if (!text) return '';
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/.exec(text);
  if (!match) return '';
  return `${match[1]}:${match[2]}`;
}

export function mergePortfolioForm(raw) {
  const base = emptyPortfolioForm();
  if (!raw || typeof raw !== 'object') return base;
  const mergedServices = { ...base.services, ...(raw.services || {}) };
  const rawOfferings = Array.isArray(raw.services?.offerings)
    ? raw.services.offerings.filter((x) => String(x || '').trim())
    : [];
  mergedServices.offerings = rawOfferings.length
    ? rawOfferings
    : [...DEFAULT_PORTFOLIO_OFFERINGS];
  const timingsIn = { ...base.timings, ...(raw.timings || {}) };

  return {
    personal: { ...base.personal, ...(raw.personal || {}) },
    center: { ...base.center, ...(raw.center || {}) },
    timings: {
      ...timingsIn,
      openingTime: normalizeClockTime(timingsIn.openingTime),
      closingTime: normalizeClockTime(timingsIn.closingTime),
    },
    services: mergedServices,
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
      introVideoUrl: (() => {
        const listed = Array.isArray(raw.mediaBrand?.introVideos)
          ? raw.mediaBrand.introVideos.filter(Boolean).map((u) => String(u))
          : [];
        if (listed.length) return listed[0];
        return raw.mediaBrand?.introVideoUrl || null;
      })(),
      introVideoLink: (() => {
        const listed = Array.isArray(raw.mediaBrand?.introVideos)
          ? raw.mediaBrand.introVideos.filter(Boolean).map((u) => String(u))
          : [];
        if (listed.length) return listed[0];
        return String(raw.mediaBrand?.introVideoLink || raw.mediaBrand?.introVideoUrl || '').trim();
      })(),
      transformations: Array.isArray(raw.mediaBrand?.transformations)
        ? raw.mediaBrand.transformations.slice(0, 6).map((t) => ({
          label: String(t?.label || t?.name || ''),
          beforePhotoUrl: t?.beforePhotoUrl ?? null,
          afterPhotoUrl: t?.afterPhotoUrl ?? null,
        }))
        : [],
      testimonials: Array.isArray(raw.mediaBrand?.testimonials)
        ? raw.mediaBrand.testimonials.slice(0, 6).map((t) => {
          const n = Number(t?.rating);
          const rating = Number.isFinite(n) ? Math.min(5, Math.max(1, Math.round(n))) : 5;
          return {
            name: String(t?.name || ''),
            quote: String(t?.quote || ''),
            rating,
          };
        })
        : [],
      social: {
        ...base.mediaBrand.social,
        ...(raw.mediaBrand?.social || {}),
      },
    },
    goalsConsent: { ...base.goalsConsent, ...(raw.goalsConsent || {}) },
  };
}
